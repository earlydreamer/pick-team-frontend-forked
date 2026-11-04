import { describe, expect, it } from 'vitest';
import { emptyCard, type PrCard } from './card';
import { aggregateTeam, matchCandidateToTeam, missingRoles, toStars, WEIGHTS } from './matching';
import type { Team } from './teamBuilding';

const card = (patch: Partial<PrCard>): PrCard => ({ ...emptyCard(), consentGivenAt: '2026-10-01', cardVisible: true, ...patch });

const team: Team = {
  id: 't',
  workspaceId: 'ws',
  name: '코드블루',
  leaderId: 'a',
  memberIds: ['a', 'b'],
  recruitRoles: [
    { role: 'BACKEND', count: 1 },
    { role: 'DESIGN', count: 1 },
  ],
};

const teamCards = [
  card({ desiredRole1: 'PM', desiredRole2: 'FRONTEND', availableTimeSlots: ['EVENING', 'WEEKEND'], goalTemperature: 4, preferWorkstyleOptions: ['SPEED_FIRST'] }),
  card({ desiredRole1: 'FRONTEND', desiredRole2: 'DESIGN', availableTimeSlots: ['EVENING'], goalTemperature: 5, preferWorkstyleOptions: ['ASYNC_FIRST'] }),
];

describe('aggregateTeam', () => {
  it('팀원 절반 이상이 고른 시간대만 공통 시간대로 본다', () => {
    expect(aggregateTeam(teamCards).commonTimeSlots.sort()).toEqual(['EVENING', 'WEEKEND']);
    const three = [...teamCards, card({ availableTimeSlots: ['MORNING'] })];
    expect(aggregateTeam(three).commonTimeSlots).toEqual(['EVENING']);
  });

  it('목표 온도 평균을 소수 첫째 자리까지 계산하고, 값이 없으면 비워 둔다', () => {
    expect(aggregateTeam(teamCards).averageTemperature).toBe(4.5);
    expect(aggregateTeam([card({})]).averageTemperature).toBeUndefined();
  });
});

describe('missingRoles', () => {
  it('팀원 1순위 역할로 채워진 모집 역할은 제외한다', () => {
    expect(missingRoles(team, teamCards)).toEqual(['BACKEND', 'DESIGN']);
    expect(missingRoles(team, [...teamCards, card({ desiredRole1: 'BACKEND' })])).toEqual(['DESIGN']);
  });
});

describe('matchCandidateToTeam', () => {
  it('필요한 역할의 1순위 희망자는 역할 점수 만점과 사유를 받는다', () => {
    const result = matchCandidateToTeam(card({ desiredRole1: 'BACKEND', desiredRole2: 'INFRA' }), team, teamCards);
    expect(result.score).toBeGreaterThanOrEqual(WEIGHTS.role);
    expect(result.reasons[0]).toContain('백엔드 희망');
  });

  it('2순위만 맞으면 역할 점수는 절반이다', () => {
    const first = matchCandidateToTeam(card({ desiredRole1: 'BACKEND' }), team, teamCards).score;
    const second = matchCandidateToTeam(card({ desiredRole1: 'PM', desiredRole2: 'BACKEND' }), team, teamCards).score;
    expect(second).toBe(first / 2);
  });

  it('사유는 기여도가 큰 신호 두 개까지만 만든다', () => {
    const result = matchCandidateToTeam(
      card({ desiredRole1: 'DESIGN', availableTimeSlots: ['EVENING', 'WEEKEND'], goalTemperature: 5, preferWorkstyleOptions: ['SPEED_FIRST', 'ASYNC_FIRST'] }),
      team,
      teamCards,
    );
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toContain('디자인');
    expect(result.stars).toBe(5);
  });

  it('기피 스타일이 팀 선호와 겹치면 협업 스타일 사유를 만들지 않는다', () => {
    const result = matchCandidateToTeam(card({ preferWorkstyleOptions: ['ASYNC_FIRST'], dislikeWorkstyleOptions: ['SPEED_FIRST'] }), team, teamCards);
    expect(result.reasons.join()).not.toContain('협업 방식');
  });

  it('MBTI는 점수에 반영하지 않는다', () => {
    const base = card({ desiredRole1: 'BACKEND' });
    expect(matchCandidateToTeam({ ...base, mbti: 'ENTJ' }, team, teamCards).score).toBe(matchCandidateToTeam(base, team, teamCards).score);
  });

  it('맞는 신호가 없으면 사유 부족을 알린다', () => {
    const result = matchCandidateToTeam(card({}), team, teamCards);
    expect(result.score).toBe(0);
    expect(result.reasons[0]).toContain('사유를 만들지 못했어요');
  });
});

describe('toStars', () => {
  it('점수를 ★ 5단계로 바꾼다', () => {
    expect([0, 20, 40, 60, 80, 100].map(toStars)).toEqual([1, 2, 3, 4, 5, 5]);
  });
});
