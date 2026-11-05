/**
 * 알림 도메인. 근거: docs/renewal/spec/16-notifications.md §4~§7.
 * 이벤트 카탈로그(§5)의 계열·우선순위·딥링크를 따른다. 알림 문구는 화면 문구라 해요체로 쓴다.
 */

export type NotificationCategory = 'TEAM_BUILDING' | 'KANBAN' | 'SCHEDULE' | 'ANNOUNCEMENT' | 'CHAT' | 'MEMBERSHIP';
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = ['TEAM_BUILDING', 'KANBAN', 'SCHEDULE', 'ANNOUNCEMENT', 'CHAT', 'MEMBERSHIP'];
export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  TEAM_BUILDING: '팀 빌딩',
  KANBAN: '칸반',
  SCHEDULE: '일정',
  ANNOUNCEMENT: '공지·게시판',
  CHAT: '채팅',
  MEMBERSHIP: '멤버십·관리',
};

export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

/** §5 카탈로그 중 리뉴얼 화면에서 실제로 발생하는 이벤트 */
export type NotificationType =
  | 'TB_APPLICATION_RECEIVED'
  | 'TB_SCOUT_RECEIVED'
  | 'TB_APPLICATION_ACCEPTED'
  | 'TB_APPLICATION_REJECTED'
  | 'TB_SCOUT_ACCEPTED'
  | 'TB_SCOUT_REJECTED'
  | 'TB_SESSION_OPENED'
  | 'TB_SESSION_RESOLVED'
  | 'TB_SESSION_CLOSING_SOON'
  | 'TB_UNASSIGNED_WARNING'
  | 'CARD_REMINDER'
  | 'KANBAN_TASK_ASSIGNED'
  | 'KANBAN_TASK_COMPLETION_REQUESTED'
  | 'KANBAN_TASK_COMPLETION_APPROVED'
  | 'KANBAN_TASK_COMPLETION_REJECTED'
  | 'SCHEDULE_CREATED'
  | 'SCHEDULE_REMINDER'
  | 'ANNOUNCEMENT_CREATED'
  | 'POST_COMMENT_ADDED'
  | 'NEW_CHAT_MESSAGE'
  | 'WS_MEMBER_JOINED'
  | 'WS_MEMBER_BANNED'
  | 'REPORT_RESOLVED'
  | 'MODERATION_NOTICE'
  | 'TEAM_LEADER_DELEGATION_REQUESTED'
  | 'TEAM_LEADER_DELEGATED';

export const TYPE_META: Record<NotificationType, { category: NotificationCategory; priority: NotificationPriority }> = {
  TB_APPLICATION_RECEIVED: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  TB_SCOUT_RECEIVED: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  TB_APPLICATION_ACCEPTED: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  TB_APPLICATION_REJECTED: { category: 'TEAM_BUILDING', priority: 'MEDIUM' },
  TB_SCOUT_ACCEPTED: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  TB_SCOUT_REJECTED: { category: 'TEAM_BUILDING', priority: 'MEDIUM' },
  TB_SESSION_OPENED: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  TB_SESSION_RESOLVED: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  TB_SESSION_CLOSING_SOON: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  TB_UNASSIGNED_WARNING: { category: 'TEAM_BUILDING', priority: 'HIGH' },
  // 카탈로그 밖 이벤트. 대시보드의 미작성자 리마인드(11 US-11-05)를 알림으로 보낸다. 카드는 팀 빌딩 참여 조건이라 팀 빌딩 계열에 둔다.
  CARD_REMINDER: { category: 'TEAM_BUILDING', priority: 'MEDIUM' },
  KANBAN_TASK_ASSIGNED: { category: 'KANBAN', priority: 'MEDIUM' },
  KANBAN_TASK_COMPLETION_REQUESTED: { category: 'KANBAN', priority: 'HIGH' },
  KANBAN_TASK_COMPLETION_APPROVED: { category: 'KANBAN', priority: 'MEDIUM' },
  KANBAN_TASK_COMPLETION_REJECTED: { category: 'KANBAN', priority: 'MEDIUM' },
  SCHEDULE_CREATED: { category: 'SCHEDULE', priority: 'MEDIUM' },
  SCHEDULE_REMINDER: { category: 'SCHEDULE', priority: 'HIGH' },
  ANNOUNCEMENT_CREATED: { category: 'ANNOUNCEMENT', priority: 'HIGH' },
  POST_COMMENT_ADDED: { category: 'ANNOUNCEMENT', priority: 'MEDIUM' },
  NEW_CHAT_MESSAGE: { category: 'CHAT', priority: 'MEDIUM' },
  WS_MEMBER_JOINED: { category: 'MEMBERSHIP', priority: 'LOW' },
  WS_MEMBER_BANNED: { category: 'MEMBERSHIP', priority: 'HIGH' },
  // 신고 처리(17 §5.1). 신고자에게는 결과만, 피신고자에게는 조치만 알린다. 운영 알림이라 계열을 꺼도 남긴다.
  REPORT_RESOLVED: { category: 'MEMBERSHIP', priority: 'MEDIUM' },
  MODERATION_NOTICE: { category: 'MEMBERSHIP', priority: 'HIGH' },
  TEAM_LEADER_DELEGATION_REQUESTED: { category: 'MEMBERSHIP', priority: 'HIGH' },
  TEAM_LEADER_DELEGATED: { category: 'MEMBERSHIP', priority: 'HIGH' },
};

export interface AppNotification {
  id: string;
  accountId: string;
  workspaceId?: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  /** 딥링크(§5 착지 화면) */
  link: string;
  read: boolean;
  createdAt: string;
  /** 묶음(§6.3)의 키. 같은 방의 채팅, 같은 팀의 지원처럼 읽지 않은 알림을 하나로 합친다 */
  groupKey?: string;
  /** 묶인 알림 수 */
  count?: number;
  /** 묶음을 시작한 시각. 묶음 기간(16-D7)을 잴 때 쓴다 */
  groupStartedAt?: string;
}

export interface NotificationSettings {
  /** 인앱 알림 전체(마스터 스위치) */
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
}

export const defaultSettings = (): NotificationSettings => ({
  enabled: true,
  categories: { TEAM_BUILDING: true, KANBAN: true, SCHEDULE: true, ANNOUNCEMENT: true, CHAT: true, MEMBERSHIP: true },
});

/** 계열을 꺼도 남기는 알림(16-D9). 마스터 스위치는 따른다. 멘션은 아직 발생하지 않는다. */
const ALWAYS_DELIVER: NotificationType[] = ['WS_MEMBER_BANNED', 'REPORT_RESOLVED', 'MODERATION_NOTICE'];

/** 이 알림을 남길지(§6.4 수신 설정 OFF 계열은 기록도 생략). */
export const shouldDeliver = (type: NotificationType, settings: NotificationSettings) =>
  settings.enabled && (ALWAYS_DELIVER.includes(type) || settings.categories[TYPE_META[type].category]);

/** 드롭다운 미리보기(§4.1, §6.3): 낮음 우선순위를 빼고 최신순 5개. */
export const previewItems = (items: AppNotification[], limit = 5) =>
  items.filter((item) => item.priority !== 'LOW').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);

/** 날짜 묶음 이름: 오늘, 어제, 그 이전은 날짜 */
export const dayGroup = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
};

export const NOTIFICATION_PAGE_SIZE = 20;

/** 팀 빌딩 마감 임박 기준(16-D3)과 일정 리마인더 시각(16-D4) */
export const CLOSING_SOON_MS = 24 * 3_600_000;
export const SCHEDULE_REMINDER_MS = 5 * 60_000;

/** 수신 설정에 보일 계열. 멤버십·관리는 매니저·개설자에게만 보인다(16-D2). */
export const visibleCategories = (manager: boolean) => NOTIFICATION_CATEGORIES.filter((category) => manager || category !== 'MEMBERSHIP');

/**
 * WS 레일 배지(16 §6.2, 16-D5). 워크스페이스에 마지막으로 들어온 뒤 생긴 미확인 알림만 센다.
 * 들어오면 바로 0이 되고, 벨 배지(전체 미확인 수)와는 따로 움직인다.
 */
export const railCounts = (items: AppNotification[], seenAt: Record<string, string>) => {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    if (item.read || !item.workspaceId) return;
    const seen = seenAt[item.workspaceId];
    if (seen && item.createdAt <= seen) return;
    counts[item.workspaceId] = (counts[item.workspaceId] ?? 0) + 1;
  });
  return counts;
};
