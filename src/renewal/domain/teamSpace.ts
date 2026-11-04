/** 팀 스페이스 공통 도메인. 근거: docs/renewal/spec/14-collab-tools.md §2, §4.1, §6.1 */

import type { Account, Member } from './workspace';
import type { Team } from './teamBuilding';
import type { KanbanProgress } from './kanban';

/** 일정 유형 5종(14-D3 유지) */
export type ScheduleType = 'MEETING' | 'DEADLINE' | 'WORKSHOP' | 'VACATION' | 'OTHER';
export const SCHEDULE_TYPES: ScheduleType[] = ['MEETING', 'DEADLINE', 'WORKSHOP', 'VACATION', 'OTHER'];
export const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = { MEETING: '회의', DEADLINE: '마감', WORKSHOP: '워크숍', VACATION: '휴가', OTHER: '기타' };

export interface Schedule {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  type: ScheduleType;
  startAt: string;
  endAt: string;
  /** 개인 일정은 만든 사람에게만 보인다(14 §4.3, §5.3) */
  personal: boolean;
  createdBy: string;
}

/** 팀 스페이스에 들어온 사람의 자격 */
export interface TeamSpaceAccess {
  isMember: boolean;
  isLeader: boolean;
  /** 팀원이 아닌 개설자·매니저. 13-D1에 따라 집계와 칸반 승인만 볼 수 있다 */
  isManagerViewer: boolean;
}

export interface TeamSpace {
  team: Team;
  members: Member[];
  /** 워크스페이스 개설자·매니저. 팀원이 아니어도 승인 기록에 이름이 남는다 */
  staff: Account[];
  access: TeamSpaceAccess;
}

export interface TeamOverview {
  progress: KanbanProgress;
  nextSchedule?: Pick<Schedule, 'id' | 'title' | 'type' | 'startAt'>;
  latestAnnouncement?: { id: string; title: string; createdAt: string };
  scheduleCount: number;
  /** 결성 직후 체크리스트의 "역할 확정" 완료 여부 */
  rolesConfirmed: boolean;
}

/** 결성 직후 체크리스트(14 §4.1): 칸반과 일정이 모두 비어 있을 때만 보여 준다. */
export const showChecklist = (overview: Pick<TeamOverview, 'progress' | 'scheduleCount'>) => overview.progress.total === 0 && overview.scheduleCount === 0;
