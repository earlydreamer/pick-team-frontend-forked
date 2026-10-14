import {
  DesiredRoleCode,
  WeeklyAvailableHoursCode,
  AvailableTimeSlotCode,
  WorkstyleOptionCode,
  User,
} from '@/features/user/types/user';

export type {
  DesiredRoleCode,
  WeeklyAvailableHoursCode,
  AvailableTimeSlotCode,
  WorkstyleOptionCode,
};

export const ROLE_META: Record<
  DesiredRoleCode,
  { label: string; shortLabel: string; colorVariant: 'peri' | 'success' | 'warning' | 'admin' | 'neutral' }
> = {
  BACKEND: { label: '백엔드', shortLabel: 'BE', colorVariant: 'peri' },
  FRONTEND: { label: '프론트엔드', shortLabel: 'FE', colorVariant: 'success' },
  FULLSTACK: { label: '풀스택', shortLabel: 'FS', colorVariant: 'admin' },
  PM: { label: 'PM·기획', shortLabel: 'PM', colorVariant: 'warning' },
  DESIGN: { label: '디자인', shortLabel: 'DS', colorVariant: 'peri' },
  INFRA: { label: '인프라·DevOps', shortLabel: 'DO', colorVariant: 'neutral' },
  AI_DATA: { label: 'AI·데이터', shortLabel: 'AI', colorVariant: 'admin' },
  OTHER: { label: '기타', shortLabel: 'ETC', colorVariant: 'neutral' },
};

export const WEEKLY_HOURS_META: Record<WeeklyAvailableHoursCode, { label: string; shortLabel: string; midpoint: number }> = {
  LT10H: { label: '10시간 미만', shortLabel: '<10h', midpoint: 8 },
  H10_20: { label: '10~20시간', shortLabel: '10~20h', midpoint: 15 },
  H20_30: { label: '20~30시간', shortLabel: '20~30h', midpoint: 25 },
  GT30H: { label: '30시간 이상', shortLabel: '30h+', midpoint: 35 },
};

export const TIME_SLOT_META: Record<AvailableTimeSlotCode, { label: string }> = {
  MORNING: { label: '오전' },
  AFTERNOON: { label: '오후' },
  EVENING: { label: '저녁' },
  WEEKEND: { label: '주말' },
};

export const WORKSTYLE_META: Record<WorkstyleOptionCode, { label: string; desc: string }> = {
  ASYNC_FIRST: { label: '비동기 우선', desc: '문서·메시지 중심 소통 선호' },
  SYNC_PREFERRED: { label: '동기 선호', desc: '실시간 회의·페어 작업 선호' },
  DETAIL_ORIENTED: { label: '꼼꼼한 문서화', desc: '명세와 기록을 체계적으로 관리' },
  SPEED_FIRST: { label: '빠른 실행 우선', desc: '프로토타입부터 빠르게 검증' },
  STRUCTURED: { label: '계획 중심 진행', desc: '마일스톤과 데드라인 엄수' },
  FLEXIBLE: { label: '유연한 진행', desc: '상황에 맞춰 우선순위 조정' },
};

export const GOAL_TEMPERATURE_META: Record<1 | 2 | 3 | 4 | 5, { label: string; desc: string }> = {
  1: { label: '1단계 · 편안한 완주', desc: '부담 없이 끝까지 완주하는 것이 목표' },
  2: { label: '2단계 · 안정적 학습', desc: '핵심 기능 구현과 학습 균형 지향' },
  3: { label: '3단계 · 균형 잡힌 완성', desc: '탄탄한 기본기와 배포 완성도 추구' },
  4: { label: '4단계 · 실서비스 수준', desc: '높은 기술적 도전과 포트폴리오 퀄리티' },
  5: { label: '5단계 · 수상·최우수 지향', desc: '최고 수준의 몰입으로 수상 목표' },
};

export type TeamBuildingSessionStatus = 'DRAFT' | 'OPEN' | 'CLOSING' | 'RESOLVED';

export interface RecruitRoleSlot {
  role: DesiredRoleCode;
  totalCount: number;
  filledCount: number;
  pendingApplyCount: number;
}

export interface TeamRecruitment {
  id: string;
  workspaceId: string;
  sessionId: string;
  name: string;
  intro: string;
  goalTemperature: 1 | 2 | 3 | 4 | 5;
  commonTimeSlots: AvailableTimeSlotCode[];
  weeklyHours: WeeklyAvailableHoursCode;
  preferWorkstyles: WorkstyleOptionCode[];
  leaderId: string;
  leaderName: string;
  memberIds: string[];
  recruitRoles: RecruitRoleSlot[];
  status: 'RECRUITING' | 'CONFIRMED' | 'DISBANDED';
  kickoffTimeNote?: string;
  createdAt: string;
}

export type ProposalDirection = 'APPLY' | 'SCOUT';
export type ProposalStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'AUTO_WITHDRAWN'
  | 'EXPIRED';

export interface TeamApplication {
  id: string;
  workspaceId: string;
  sessionId: string;
  direction: ProposalDirection;
  applicantId: string; // 개인 ID (APPLY면 발신자, SCOUT면 수신 대상 멤버)
  applicantName: string;
  applicantRole1?: DesiredRoleCode;
  targetTeamId: string;
  targetTeamName: string;
  desiredRole: DesiredRoleCode;
  message: string;
  status: ProposalStatus;
  statusReason?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface TeamBuildingSession {
  id: string;
  workspaceId: string;
  name: string;
  status: TeamBuildingSessionStatus;
  startAt: string;
  endAt: string;
  teamSizeMin: number;
  teamSizeMax: number;
  allowMemberTeamCreate: boolean;
  resolvedAt?: string;
}

export interface MatchBreakdown {
  roleScore: number; // max 40
  timeScore: number; // max 25
  tempScore: number; // max 20
  styleScore: number; // max 15
  totalScore: number; // max 100
  stars: 1 | 2 | 3 | 4 | 5;
  reasons: string[]; // Top 2~3 explainable reasons
}

export type KanbanTaskStatus = 'TODO' | 'IN_PROGRESS' | 'APPROVAL_PENDING' | 'DONE';

export interface RenewalKanbanTask {
  id: string;
  workspaceId: string;
  teamId: string;
  teamName: string;
  title: string;
  description: string;
  status: KanbanTaskStatus;
  assigneeId: string;
  assigneeName: string;
  deadline?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
  completionRequestMessage?: string;
  completionRequestedAt?: string;
  approvedBy?: string;
  approvedByRole?: 'LEADER' | 'MANAGER';
  approvedAt?: string;
  rejectionReason?: string;
  comments: {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: string;
  }[];
  updatedAt: string;
}

export type NotificationCategory =
  | 'TEAM_BUILDING'
  | 'KANBAN'
  | 'SCHEDULE'
  | 'BOARD'
  | 'CHAT'
  | 'ADMIN';

export interface RenewalNotification {
  id: string;
  workspaceId?: string;
  category: NotificationCategory;
  eventCode: string;
  title: string;
  message: string;
  deepLink: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  read: boolean;
  createdAt: string;
}

export interface NotificationSettingsState {
  masterEnabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  mutedChatRoomIds: string[];
}

export type ReportTargetType = 'USER' | 'MESSAGE' | 'POST' | 'CARD';
export type ReportReasonType = 'ABUSE' | 'SPAM' | 'PRIVACY' | 'OTHER';
export type ReportStatusType = 'RECEIVED' | 'REVIEWING' | 'DISMISSED' | 'ACTED';
export type ReportActionType = 'WARNED' | 'CONTENT_REMOVED' | 'BANNED_WS' | 'BANNED_SYSTEM';

export interface SafetyReport {
  id: string;
  workspaceId: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  targetContentSnippet: string;
  reason: ReportReasonType;
  reasonDetail?: string;
  status: ReportStatusType;
  actionType?: ReportActionType;
  adminMemo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DelegationRequest {
  teamId: string;
  fromLeaderId: string;
  fromLeaderName: string;
  targetMemberId: string;
  targetMemberName: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requestedAt: string;
}

export interface PersonalOrTeamSchedule {
  id: string;
  workspaceId: string;
  teamId?: string;
  title: string;
  startDate: string; // YYYY-MM-DDTHH:mm
  endDate: string;
  scheduleDesc?: string;
  type: 'MEETING' | 'DEADLINE' | 'WORKSHOP' | 'VACATION' | 'OTHER';
  isPersonal: boolean;
  creatorId: string;
  creatorName: string;
  reminderMinutesBefore?: number;
}

export interface WorkspaceNoticeItem {
  id: string;
  workspaceId: string;
  teamId?: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  pinned?: boolean;
  readByIds: string[];
  createdAt: string;
}

export interface MemberPRCardProfile extends User {
  workspaceRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  workspaceStatus: 'ACTIVE' | 'BANNED' | 'LEFT';
  assignedTeamId?: string | null;
  assignedTeamName?: string | null;
}
