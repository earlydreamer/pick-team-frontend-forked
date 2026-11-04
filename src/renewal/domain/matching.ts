import { ROLE_LABEL, WORKSTYLE_LABEL, type PrCard, type TimeSlot } from './card';
import { TIME_SLOT_LABEL } from './card';
import type { Team, TeamAggregate } from './teamBuilding';

/**
 * 매칭 v1: 규칙 기반 점수와 사유(12 §5.3).
 * 가중치는 역할 상보성 40, 가용 시간 25, 목표 온도 20, 협업 스타일 15이며 MBTI는 반영하지 않는다.
 * 점수는 0~100이고 화면에는 ★ 5단계로만 보여 준다(12-D2). 사유는 기여도가 큰 신호 두 개를 문장으로 만든다.
 */

export const WEIGHTS = { role: 40, time: 25, temperature: 20, workstyle: 15 } as const;

export interface MatchResult {
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  reasons: string[];
}

interface Signal {
  points: number;
  reason?: string;
}

/** 팀원 카드로 팀 집계를 만든다. 공통 시간대는 팀원 절반 이상이 고른 시간대다. */
export const aggregateTeam = (memberCards: PrCard[]): TeamAggregate => {
  const counts = new Map<TimeSlot, number>();
  memberCards.forEach((card) => card.availableTimeSlots.forEach((slot) => counts.set(slot, (counts.get(slot) ?? 0) + 1)));
  const threshold = Math.max(1, Math.ceil(memberCards.length / 2));
  const commonTimeSlots = [...counts.entries()].filter(([, count]) => count >= threshold).map(([slot]) => slot);
  const temperatures = memberCards.map((card) => card.goalTemperature).filter((value): value is NonNullable<typeof value> => value !== undefined);
  const averageTemperature = temperatures.length ? Math.round((temperatures.reduce((a, b) => a + b, 0) / temperatures.length) * 10) / 10 : undefined;
  return { commonTimeSlots, averageTemperature };
};

/** 팀이 아직 채우지 못한 모집 역할 */
export const missingRoles = (team: Team, memberCards: PrCard[]) =>
  team.recruitRoles
    .filter((recruit) => memberCards.filter((card) => card.desiredRole1 === recruit.role).length < recruit.count)
    .map((recruit) => recruit.role);

const roleSignal = (candidate: PrCard, needed: string[]): Signal => {
  if (candidate.desiredRole1 && needed.includes(candidate.desiredRole1)) {
    return { points: WEIGHTS.role, reason: `${ROLE_LABEL[candidate.desiredRole1]} 희망, 팀에 필요한 역할` };
  }
  if (candidate.desiredRole2 && needed.includes(candidate.desiredRole2)) {
    return { points: WEIGHTS.role / 2, reason: `2순위 ${ROLE_LABEL[candidate.desiredRole2]}, 팀에 필요한 역할` };
  }
  return { points: 0 };
};

const timeSignal = (candidate: PrCard, teamSlots: TimeSlot[]): Signal => {
  if (!teamSlots.length || !candidate.availableTimeSlots.length) return { points: 0 };
  const overlap = candidate.availableTimeSlots.filter((slot) => teamSlots.includes(slot));
  if (!overlap.length) return { points: 0 };
  return {
    points: Math.round((WEIGHTS.time * overlap.length) / teamSlots.length),
    reason: `${overlap.map((slot) => TIME_SLOT_LABEL[slot]).join('·')} 가용 시간 겹침`,
  };
};

const temperatureSignal = (candidate: PrCard, average?: number): Signal => {
  if (candidate.goalTemperature === undefined || average === undefined) return { points: 0 };
  const gap = Math.abs(candidate.goalTemperature - average);
  const points = Math.round((WEIGHTS.temperature * Math.max(0, 4 - gap)) / 4);
  if (gap > 1) return { points };
  const side = average >= 3.5 ? '수상 지향' : average <= 2.5 ? '완주 지향' : '중간';
  return { points, reason: `목표 온도 근접(${side})` };
};

const workstyleSignal = (candidate: PrCard, teamCards: PrCard[]): Signal => {
  const teamPrefer = new Set(teamCards.flatMap((card) => card.preferWorkstyleOptions));
  if (!teamPrefer.size) return { points: 0 };
  const matched = candidate.preferWorkstyleOptions.filter((style) => teamPrefer.has(style));
  const conflicts = candidate.dislikeWorkstyleOptions.filter((style) => teamPrefer.has(style));
  const raw = (matched.length - conflicts.length) * (WEIGHTS.workstyle / 3);
  const points = Math.round(Math.max(0, Math.min(WEIGHTS.workstyle, raw)));
  if (!matched.length || conflicts.length) return { points };
  return { points, reason: `선호 협업 방식 ${matched.length}개 일치(${matched.map((style) => WORKSTYLE_LABEL[style]).join(', ')})` };
};

export const toStars = (score: number): MatchResult['stars'] => (score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1);

/** 후보 한 명과 팀의 적합도. 사람 추천(팀 시점)과 팀 추천(개인 시점)이 같은 계산을 쓴다. */
export const matchCandidateToTeam = (candidate: PrCard, team: Team, teamCards: PrCard[]): MatchResult => {
  const aggregate = aggregateTeam(teamCards);
  const needed = missingRoles(team, teamCards);
  const signals = [
    roleSignal(candidate, needed),
    timeSignal(candidate, aggregate.commonTimeSlots),
    temperatureSignal(candidate, aggregate.averageTemperature),
    workstyleSignal(candidate, teamCards),
  ];
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.points, 0));
  const reasons = signals
    .filter((signal) => signal.reason)
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((signal) => signal.reason!);
  return { score, stars: toStars(score), reasons: reasons.length ? reasons : ['카드 정보가 적어 사유를 만들지 못했어요'] };
};
