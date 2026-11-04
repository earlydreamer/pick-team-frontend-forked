/** 팀 빌딩 도메인. 근거: docs/renewal/spec/12-team-building.md §5 */

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

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  leaderId: string;
  memberIds: string[];
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
