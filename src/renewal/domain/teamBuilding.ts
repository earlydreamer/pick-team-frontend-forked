/** 팀 빌딩 도메인. 근거: docs/renewal/spec/12-team-building.md §5 */

import type { GoalTemperature, Role, TimeSlot } from './card';
import type { Account, Member } from './workspace';
import type { MatchResult } from './matching';

export type SessionStatus = 'DRAFT' | 'OPEN' | 'CLOSING' | 'RESOLVED';
export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  DRAFT: '준비 중',
  OPEN: '모집 중',
  CLOSING: '배정 중',
  RESOLVED: '완료',
};

export interface TeamBuildingSession {
  id: string;
  workspaceId: string;
  status: SessionStatus;
  /** 모집 마감 시각(ISO) */
  closesAt: string;
  teamCapacity: number;
}


export interface RecruitRole {
  role: Role;
  count: number;
  note?: string;
}

/** 팀. 세션 중에는 모집 공고(TeamRecruitment) 정보를 함께 가진다(12 §6.1). */
export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  /** 모집 공고 소개(한 줄) */
  intro?: string;
  goalTemperature?: GoalTemperature;
  recruitRoles: RecruitRole[];
  /** 진행 중인 팀장 위임 요청(14 §5.4). 24시간이 지나면 만료로 본다 */
  delegation?: { targetId: string; requestedAt: string };
}

/** APPLY: 개인 → 팀 지원, SCOUT: 팀 → 개인 제안. 수락 권한은 항상 받은 쪽에 있다(12 §5.2). */
export type ApplicationDirection = 'APPLY' | 'SCOUT';
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'AUTO_WITHDRAWN' | 'EXPIRED';

export interface TeamApplication {
  id: string;
  sessionId: string;
  direction: ApplicationDirection;
  /** 지원자 또는 스카우트 대상 멤버 */
  applicantId: string;
  teamId: string;
  message?: string;
  status: ApplicationStatus;
  /** 종료 사유(예: 정원 마감, 다른 제안 성립) */
  reason?: string;
  createdAt: string;
  decidedAt?: string;
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: '답변 대기',
  ACCEPTED: '수락됨',
  DECLINED: '거절됨',
  WITHDRAWN: '철회됨',
  AUTO_WITHDRAWN: '자동 철회됨',
  EXPIRED: '만료됨',
};

/** 12 §8 결정 사항 */
export const TEAM_BUILDING_RULES = {
  /** 12-D4: 동시에 답변 대기 중인 지원은 3건까지 */
  maxPendingApplies: 3,
  messageMax: 200,
  teamNameMax: 20,
  introMax: 100,
} as const;

export const openSeats = (team: Team, capacity: number) => Math.max(capacity - team.memberIds.length, 0);

/** 팀 단위 집계(12-D6: 개인값이 아닌 집계만 공개). */
export interface TeamAggregate {
  /** 팀원 절반 이상이 고른 시간대 */
  commonTimeSlots: TimeSlot[];
  /** 팀원 목표 온도 평균(소수 첫째 자리) */
  averageTemperature?: number;
}

/** 마감까지 남은 날(마감 당일 0, 지나면 음수) */
export const daysUntil = (iso: string, now = new Date()) => {
  const end = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((startOfEnd.getTime() - startOfToday.getTime()) / 86_400_000);
};

export const dDayLabel = (iso: string, now = new Date()) => {
  const days = daysUntil(iso, now);
  return days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : '마감';
};

/* ── 화면용 조회 모델 ── */

export interface MyTeamBuildingStatus {
  /** 개설자·매니저는 당사자가 아니다(12 §2) */
  isParticipant: boolean;
  cardPublic: boolean;
  teamId?: string;
  isLeader: boolean;
  sentPending: number;
  receivedPending: number;
}

export interface TeamSummary {
  team: Team;
  capacity: number;
  openSeats: number;
  pendingApplies: number;
  myApplicationStatus?: ApplicationStatus;
  /** 내가 팀이 없고 카드가 공개 상태일 때만 계산한다 */
  fit?: MatchResult;
}

export interface TeamBuildingBoard {
  session: TeamBuildingSession;
  me: MyTeamBuildingStatus;
  teams: TeamSummary[];
}

export interface TeamDetail extends TeamSummary {
  members: Member[];
  aggregate: TeamAggregate;
  /** 팀장에게만 내려오는 받은 지원 */
  receivedApplications?: ApplicationView[];
}

export type Recommendation =
  | { kind: 'TEAM'; summary: TeamSummary; fit: MatchResult }
  | { kind: 'MEMBER'; member: Member; fit: MatchResult; canScout: boolean };

export interface ApplicationView {
  application: TeamApplication;
  team: Pick<Team, 'id' | 'name'>;
  applicant: Account;
}

export interface Inbox {
  received: ApplicationView[];
  sent: ApplicationView[];
}

export interface CreateTeamInput {
  name: string;
  intro?: string;
  goalTemperature?: GoalTemperature;
  recruitRoles: RecruitRole[];
}

/* ── 세션 운영(SCR-TB-04, 12 §4.4) ── */

/** 세션 설정 범위. 기획의 정원 min/max는 단일 정원으로 단순화했다(docs/renewal/implementation.md R6). */
export const SESSION_RULES = {
  capacityMin: 2,
  capacityMax: 8,
} as const;

export interface SessionSettingsInput {
  /** 모집 마감 시각(ISO) */
  closesAt: string;
  teamCapacity: number;
}

export interface ManagedTeam {
  team: Team;
  members: Member[];
  openSeats: number;
}

/** 운영 화면 조회 모델. 참여 대상은 MEMBER 역할만 센다(12 §2). */
export interface SessionManageView {
  session: TeamBuildingSession | null;
  participants: number;
  assigned: number;
  unassigned: Member[];
  /** 카드를 쓰지 않았거나 동의하지 않은 참여 대상 */
  cardNotWritten: number;
  teams: ManagedTeam[];
  pendingApplications: number;
}

export interface RandomAssignResult {
  assigned: number;
  /** 빈자리가 모자라 배치하지 못한 인원 */
  remaining: number;
}

/** 세션 설정 검증. 오류가 없으면 빈 객체를 돌려준다. */
export const validateSessionSettings = (input: SessionSettingsInput, now = new Date(), previousClosesAt?: string) => {
  const errors: Partial<Record<keyof SessionSettingsInput, string>> = {};
  const closes = new Date(input.closesAt);
  if (Number.isNaN(closes.getTime())) errors.closesAt = '모집 마감 일시를 입력해 주세요.';
  else if (closes.getTime() <= now.getTime()) errors.closesAt = '모집 마감은 지금보다 뒤여야 해요.';
  else if (previousClosesAt && closes.getTime() <= new Date(previousClosesAt).getTime()) errors.closesAt = '연장할 마감은 지금 마감보다 뒤여야 해요.';
  if (!Number.isInteger(input.teamCapacity) || input.teamCapacity < SESSION_RULES.capacityMin || input.teamCapacity > SESSION_RULES.capacityMax) {
    errors.teamCapacity = `팀 정원은 ${SESSION_RULES.capacityMin}~${SESSION_RULES.capacityMax}명으로 정해 주세요.`;
  }
  return errors;
};

/** 마감 시각 표시. 예) 11월 7일 (토) 오후 11:59 */
export const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** ISO 시각을 datetime-local 입력값(로컬 시각, 분 단위)으로 바꾼다. */
export const toLocalInputValue = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** datetime-local 입력값을 ISO 시각으로 바꾼다. 비어 있거나 잘못된 값이면 빈 문자열을 돌려준다. */
export const fromLocalInputValue = (value: string) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
};
