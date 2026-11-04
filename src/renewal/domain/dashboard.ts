/** 강사 대시보드 도메인. 근거: docs/renewal/spec/13-workspace-admin.md §4.4, §4.5 */

import type { Account } from './workspace';
import type { SessionStatus } from './teamBuilding';

/** 위젯 C의 팀별 진행도. 13-D1에 따라 팀 내부 내용은 빼고 집계만 담는다. */
export interface TeamProgress {
  teamId: string;
  teamName: string;
  /** 칸반 완료율(0~100) */
  completionRate: number;
  pendingApprovals: number;
}

/** 진행도 승인 대기 태스크(13 §4.5) */
export interface ApprovalRequest {
  id: string;
  teamId: string;
  teamName: string;
  taskTitle: string;
  requester: Account;
  requestedAt: string;
}

export type DashboardAlert =
  | { kind: 'INACTIVE_TEAM'; teamId: string; teamName: string; days: number }
  | { kind: 'BAN_HISTORY'; account: Account; count: number };

export interface DashboardView {
  workspace: { name: string; memberCount: number; capacity?: number };
  /** 위젯 A: 참여 대상(MEMBER 역할) 기준 카드 현황 */
  cards: { participants: number; written: number; notWritten: number };
  /** 위젯 B: 세션이 없으면 null */
  teamBuilding: { status: SessionStatus; closesAt: string; assigned: number; unassigned: number } | null;
  progress: TeamProgress[];
  approvals: ApprovalRequest[];
  alerts: DashboardAlert[];
}

/** 이상 신호로 보는 칸반 무활동 기간(일) */
export const INACTIVE_DAYS = 7;

export const writtenRate = (cards: DashboardView['cards']) => (cards.participants === 0 ? 0 : Math.round((cards.written / cards.participants) * 100));
