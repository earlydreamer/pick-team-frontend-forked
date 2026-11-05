import { emptyCard, type PrCard } from '@/renewal/domain/card';
import type { Account, WorkspaceRole } from '@/renewal/domain/workspace';
import type { Team, TeamApplication, TeamBuildingSession } from '@/renewal/domain/teamBuilding';
import type { Announcement } from '@/renewal/domain/announcement';
import type { KanbanTask } from '@/renewal/domain/kanban';
import type { Schedule } from '@/renewal/domain/teamSpace';
import type { Post } from '@/renewal/domain/collab';
import type { ChatMessage, ChatRoom, VideoChannel } from '@/renewal/domain/chat';
import type { AppNotification, NotificationSettings } from '@/renewal/domain/notification';
import type { PolicyConsent } from '@/renewal/domain/policy';
import type { ReportAction, ReportReason, ReportStatus, ReportTargetType } from '@/renewal/domain/report';

/**
 * 목업 단계의 데이터 저장소. 브라우저 localStorage에 저장해 새로고침해도 유지된다.
 * 이름·카드 내용은 시연용 가상 데이터이며, 화면 상단 "목업 데이터" 표시로 실제 데이터와 구분한다.
 */

export interface MockWorkspace {
  id: string;
  name: string;
  /** 워크스페이스 정원(초대 링크 사용 한도). 없으면 제한 없음 */
  capacity?: number;
  /** 합류 비밀번호 해시(10-D4). 없으면 비밀번호 없이 합류한다 */
  passwordHash?: string;
  members: { accountId: string; role: WorkspaceRole; teamId?: string }[];
  /** 보관(아카이브)한 시각. 있으면 읽기 전용이다(01-D4) */
  archivedAt?: string;
}


export interface MockDb {
  version: number;
  currentAccountId: string | null;
  accounts: Account[];
  cards: Record<string, PrCard>;
  workspaces: MockWorkspace[];
  sessions: TeamBuildingSession[];
  teams: Team[];
  announcements: (Announcement & { workspaceId: string })[];
  applications: TeamApplication[];
  /** 칸반 태스크. 강사 대시보드의 진행도·승인 대기·무활동 신호도 여기서 계산한다 */
  tasks: KanbanTask[];
  schedules: Schedule[];
  posts: Post[];
  /** 채팅방. 팀 방은 멤버를 팀 소속에서 계산하므로 memberIds를 비워 둔다 */
  chatRooms: ChatRoom[];
  chatMessages: ChatMessage[];
  /** 마지막으로 읽은 시각. 키는 `방:계정` */
  chatReads: Record<string, string>;
  /** 알림을 끈 방. 값은 `방:계정` */
  chatMutes: string[];
  videoChannels: VideoChannel[];
  /** 회의에 들어와 있는 사람(VideoMember). 나가면 지운다 */
  videoPresence: { channelId: string; accountId: string; joinedAt: string }[];
  /** NotificationLog(16 §7.1). 새 알림은 data/mock/notifyRules.ts가 기록한다 */
  notifications: AppNotification[];
  /** 계정별 수신 설정. 없으면 기본값(전부 켬) */
  notificationSettings: Record<string, NotificationSettings>;
  /** 시각 기반 알림을 보낸 기록. 같은 알림을 두 번 보내지 않게 한다(timedRules) */
  sentTimedEvents: string[];
  /** WS 레일 배지 기준 시각. 키는 `계정:워크스페이스`(16-D5) */
  workspaceSeenAt: Record<string, string>;
  /** 결성 직후 체크리스트에서 "역할 확정"을 마친 팀 */
  rolesConfirmedTeamIds: string[];
  /** 이번 기수 차단 이력(위젯 D). 차단된 계정은 멤버 목록에 없다. */
  bans: { workspaceId: string; accountId: string; bannedAt: string }[];
  /** 카드 미작성자 리마인드 발송 기록. 알림은 notifyRules.onCardReminder가 따로 남긴다. */
  reminders: { workspaceId: string; accountIds: string[]; sentAt: string }[];
  /** 이메일 계정의 비밀번호 해시. OAuth로만 가입한 계정은 없다 */
  credentials: Record<string, { passwordHash: string }>;
  /** 이메일 인증·비밀번호 재설정 코드(5분 유효, 10 §6.4) */
  verifications: MockVerification[];
  /** 초대 링크 v2(10 §5.5, §6.3) */
  invites: MockInvite[];
  oauthLinks: { provider: 'google' | 'kakao'; subject: string; accountId: string }[];
  /** 약관·개인정보·연령 동의(17 §6.2). 없으면 첫 화면 전에 동의를 받는다 */
  policyConsents: Record<string, PolicyConsent>;
  /** 신고(17 §6.5). 신고자 id는 관리자 화면에도 내보내지 않는다 */
  reports: MockReport[];
}

export interface MockReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  workspaceId: string;
  targetAccountId: string;
  snapshot: string;
  reason: ReportReason;
  detail?: string;
  status: ReportStatus;
  action?: Exclude<ReportAction, 'DISMISS'>;
  adminMemo?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface MockVerification {
  email: string;
  purpose: 'SIGNUP' | 'RESET';
  code: string;
  expiresAt: string;
  verified: boolean;
}

export interface MockInvite {
  workspaceId: string;
  code: string;
  /** null이면 만료 없음 */
  expiresAt: string | null;
  /** 재발급하면 false가 된다 */
  active: boolean;
  usedCount: number;
}

/**
 * 목업 비밀번호 해시. 브라우저 저장소에 평문 비밀번호를 남기지 않기 위한 장치일 뿐이며 실제 보안 수단이 아니다.
 * 시드 계정의 비밀번호는 모두 Pickteam1! 이다.
 */
export const MOCK_PASSWORD = 'Pickteam1!';
const SEED_PASSWORD_HASH = 'adb7a220a9fc0f2e7f11eb83d815e591330158c0b16f2db35ee86f06c83c7db0';
/** ws-3 합류 비밀번호 study */
const SEED_WORKSPACE_PASSWORD_HASH = '6b5960ce025fca41a5e127b14ad6a8544685e224ef4566816cf90726d81c4ebc';

const STORAGE_KEY = 'pickteam.renewal.mock';
const VERSION = 13;

const daysFromNow = (days: number, hour = 23, minute = 59) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const consented = (card: Partial<PrCard>): PrCard => ({
  ...emptyCard(),
  consentGivenAt: '2026-10-28T09:00:00.000Z',
  cardVisible: true,
  ...card,
});

const people: [string, string][] = [
  ['u-student', '김수강'],
  ['u-instructor', '박강사'],
  ['u-manager', '정매니저'],
  ['u-01', '김철수'],
  ['u-02', '이영희'],
  ['u-03', '박민준'],
  ['u-04', '최지아'],
  ['u-05', '한서준'],
  ['u-06', '오다은'],
  ['u-07', '윤지호'],
  ['u-08', '서하린'],
  ['u-09', '장우진'],
  ['u-10', '임채원'],
  ['u-11', '강도윤'],
  ['u-12', '홍길동'],
  ['u-admin', '운영자'],
];

const dateFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const atFromNow = (days: number, hour: number, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

/**
 * 칸반 시드. 완료율은 알파팀 60%, 데이터 크루 40%, 달빛 80%이고,
 * 데이터 크루는 8일 동안 갱신이 없어 대시보드 이상 신호에 잡힌다(R6 대시보드 시연 값과 같다).
 */
const seedTasks = (): KanbanTask[] => {
  const make = (
    id: string,
    teamId: string,
    title: string,
    status: KanbanTask['status'],
    assigneeId: string,
    updatedHoursAgo: number,
    extra: Partial<KanbanTask> = {},
  ): KanbanTask => ({
    id,
    teamId,
    title,
    status,
    assigneeIds: [assigneeId],
    createdBy: assigneeId,
    createdAt: hoursAgo(updatedHoursAgo + 48),
    updatedAt: hoursAgo(updatedHoursAgo),
    comments: [],
    ...(status === 'DONE' ? { approvedBy: extra.approvedBy ?? assigneeId, approvedAt: hoursAgo(updatedHoursAgo) } : {}),
    ...(status === 'APPROVAL_PENDING' ? { completionRequestedBy: assigneeId, completionRequestedAt: hoursAgo(updatedHoursAgo) } : {}),
    ...extra,
  });
  return [
    make('k-1', 't-1', '요구사항 정리', 'DONE', 'u-01', 120),
    make('k-2', 't-1', '화면 흐름도 그리기', 'DONE', 'u-02', 110, { approvedBy: 'u-01' }),
    make('k-3', 't-1', '개발 환경 세팅', 'DONE', 'u-01', 100),
    make('k-4', 't-1', '로그인 API 완성', 'APPROVAL_PENDING', 'u-01', 72, {
      content: 'JWT 발급과 재발급까지 포함해요.',
      completionRequestMessage: '테스트까지 마쳤어요.',
      deadline: dateFromNow(2),
    }),
    make('k-5', 't-1', 'DB 스키마 설계', 'APPROVAL_PENDING', 'u-02', 5, {
      comments: [{ id: 'c-1', authorId: 'u-01', content: '팀 테이블에 소개 컬럼도 넣어 주세요.', createdAt: hoursAgo(3) }],
    }),
    make('k-6', 't-1', '알림 설계', 'TODO', 'u-02', 30, { assigneeIds: [] }),
    make('k-7', 't-1', '프로필 화면 구현', 'IN_PROGRESS', 'u-02', 20, { deadline: dateFromNow(-1) }),
    make('k-8', 't-1', '와이어프레임 검토', 'DONE', 'u-02', 90, { approvedBy: 'u-01' }),
    make('k-9', 't-1', 'API 명세 초안', 'DONE', 'u-01', 85),
    make('k-10', 't-1', '디자인 토큰 정리', 'DONE', 'u-02', 80, { approvedBy: 'u-01' }),
    make('k-11', 't-2', '데이터 수집 계획', 'DONE', 'u-05', 260),
    make('k-12', 't-2', '크롤러 프로토타입', 'DONE', 'u-04', 240, { approvedBy: 'u-05' }),
    make('k-13', 't-2', '모델 후보 비교', 'IN_PROGRESS', 'u-05', 200),
    make('k-14', 't-2', '대시보드 시안', 'IN_PROGRESS', 'u-04', 195),
    make('k-15', 't-2', '발표 자료 틀', 'TODO', 'u-04', 192),
    make('k-16', 't-3', '서비스 컨셉 정리', 'DONE', 'u-08', 150),
    make('k-17', 't-3', '사용자 인터뷰', 'DONE', 'u-06', 140, { approvedBy: 'u-08' }),
    make('k-18', 't-3', '경쟁 서비스 분석', 'DONE', 'u-08', 130),
    make('k-19', 't-3', '정보 구조 설계', 'DONE', 'u-06', 60, { approvedBy: 'u-08' }),
    make('k-20', 't-3', '와이어프레임 완성', 'APPROVAL_PENDING', 'u-06', 24),
  ];
};

const seedSchedules = (): Schedule[] => [
  { id: 'sc-1', teamId: 't-1', title: '스프린트 회의', type: 'MEETING', startAt: atFromNow(2, 14), endAt: atFromNow(2, 15), personal: false, createdBy: 'u-01' },
  { id: 'sc-2', teamId: 't-1', title: '중간 발표', type: 'DEADLINE', startAt: atFromNow(9, 10), endAt: atFromNow(9, 12), personal: false, createdBy: 'u-01' },
  { id: 'sc-3', teamId: 't-1', title: '병원 예약', type: 'OTHER', startAt: atFromNow(1, 11), endAt: atFromNow(1, 12), personal: true, createdBy: 'u-01' },
  { id: 'sc-4', teamId: 't-3', title: '디자인 리뷰', type: 'MEETING', startAt: atFromNow(1, 20), endAt: atFromNow(1, 21), personal: false, createdBy: 'u-08' },
];

export const seed = (): MockDb => ({
  version: VERSION,
  currentAccountId: 'u-student',
  accounts: people.map(([id, name], index) => ({ id, name, email: `user${index + 1}@example.com`, profileImageUrl: null, ...(id === 'u-admin' ? { systemRole: 'ADMIN' as const } : {}) })),
  cards: {
    // 수강생 본인: 동의 전 상태로 시작해 온보딩 위저드를 체험할 수 있게 한다.
    'u-student': emptyCard(),
    'u-instructor': emptyCard(),
    'u-manager': emptyCard(),
    'u-01': consented({ desiredRole1: 'BACKEND', desiredRole2: 'INFRA', weeklyAvailableHours: 'H20_30', availableTimeSlots: ['EVENING', 'WEEKEND'], goalTemperature: 4, hashtags: ['Java', 'Spring', 'MySQL'], preferWorkstyleOptions: ['STRUCTURED', 'DETAIL_ORIENTED'], introduction: '서버와 데이터 모델링을 좋아해요.', mbti: 'ISTJ' }),
    'u-02': consented({ desiredRole1: 'FRONTEND', desiredRole2: 'DESIGN', weeklyAvailableHours: 'H10_20', availableTimeSlots: ['AFTERNOON', 'EVENING'], goalTemperature: 3, hashtags: ['React', 'TypeScript', 'Figma'], preferWorkstyleOptions: ['ASYNC_FIRST'], introduction: '사용자가 헤매지 않는 화면을 만들고 싶어요.', portfolio: 'https://github.com/example-yh' }),
    'u-03': consented({ desiredRole1: 'BACKEND', desiredRole2: 'FULLSTACK', weeklyAvailableHours: 'LT10H', availableTimeSlots: ['WEEKEND'], goalTemperature: 2, hashtags: ['NodeJS', 'DevOps'], }),
    'u-04': consented({ desiredRole1: 'FRONTEND', desiredRole2: 'PM', weeklyAvailableHours: 'H10_20', availableTimeSlots: ['EVENING'], goalTemperature: 5, hashtags: ['Vue', '기획'], preferWorkstyleOptions: ['SPEED_FIRST', 'SYNC_PREFERRED'], workstyleText: '아이디어를 빠르게 검증하는 팀을 좋아해요.' }),
    'u-05': consented({ desiredRole1: 'AI_DATA', desiredRole2: 'BACKEND', weeklyAvailableHours: 'GT30H', availableTimeSlots: ['MORNING', 'AFTERNOON'], goalTemperature: 5, hashtags: ['Python', 'PyTorch'] }),
    'u-06': consented({ desiredRole1: 'DESIGN', desiredRole2: 'FRONTEND', weeklyAvailableHours: 'H20_30', availableTimeSlots: ['AFTERNOON'], goalTemperature: 3, hashtags: ['Figma', 'UX리서치'] }),
    'u-07': consented({ desiredRole1: 'PM', desiredRole2: 'BACKEND', weeklyAvailableHours: 'H10_20', availableTimeSlots: ['EVENING', 'WEEKEND'], goalTemperature: 4, hashtags: ['Notion', 'Jira'] }),
    'u-08': consented({ desiredRole1: 'FULLSTACK', desiredRole2: 'FRONTEND', weeklyAvailableHours: 'H20_30', availableTimeSlots: ['EVENING'], goalTemperature: 3, hashtags: ['NextJS', 'Prisma'] }),
    // 비공개 카드와 미작성 카드(갤러리 흐린 표시 대상)
    'u-09': consented({ desiredRole1: 'INFRA', desiredRole2: 'BACKEND', weeklyAvailableHours: 'H10_20', cardVisible: false }),
    'u-10': { ...emptyCard(), consentGivenAt: '2026-10-29T09:00:00.000Z' },
    'u-11': emptyCard(),
  },
  workspaces: [
    {
      id: 'ws-1',
      name: '2026 하계 부트캠프',
      capacity: 30,
      members: [
        { accountId: 'u-instructor', role: 'OWNER' },
        { accountId: 'u-manager', role: 'ADMIN' },
        { accountId: 'u-student', role: 'MEMBER' },
        { accountId: 'u-01', role: 'MEMBER', teamId: 't-1' },
        { accountId: 'u-02', role: 'MEMBER', teamId: 't-1' },
        { accountId: 'u-03', role: 'MEMBER' },
        { accountId: 'u-04', role: 'MEMBER', teamId: 't-2' },
        { accountId: 'u-05', role: 'MEMBER', teamId: 't-2' },
        { accountId: 'u-06', role: 'MEMBER', teamId: 't-3' },
        { accountId: 'u-07', role: 'MEMBER' },
        { accountId: 'u-08', role: 'MEMBER', teamId: 't-3' },
        { accountId: 'u-09', role: 'MEMBER' },
        { accountId: 'u-10', role: 'MEMBER' },
        { accountId: 'u-11', role: 'MEMBER' },
      ],
    },
    {
      id: 'ws-2',
      name: '알고리즘 스터디',
      members: [
        { accountId: 'u-student', role: 'OWNER' },
        { accountId: 'u-01', role: 'MEMBER' },
        { accountId: 'u-02', role: 'MEMBER' },
      ],
    },
    {
      // 초대 랜딩 시연용: 김수강이 아직 속하지 않았고 합류 비밀번호가 있는 워크스페이스
      id: 'ws-3',
      name: 'UX 리서치 스터디',
      passwordHash: SEED_WORKSPACE_PASSWORD_HASH,
      members: [
        { accountId: 'u-instructor', role: 'OWNER' },
        { accountId: 'u-05', role: 'MEMBER' },
      ],
    },
  ],
  sessions: [{ id: 's-1', workspaceId: 'ws-1', status: 'OPEN', closesAt: daysFromNow(3), teamCapacity: 4 }],
  applications: [
    { id: 'app-1', sessionId: 's-1', direction: 'SCOUT', applicantId: 'u-student', teamId: 't-3', message: '프론트엔드 자리가 있어요. 저녁에 같이 할 수 있을 것 같아요.', status: 'PENDING', createdAt: hoursAgo(2) },
    { id: 'app-2', sessionId: 's-1', direction: 'SCOUT', applicantId: 'u-student', teamId: 't-1', message: '같이 하실래요?', status: 'EXPIRED', reason: '팀 정원 조정으로 만료', createdAt: hoursAgo(72), decidedAt: hoursAgo(48) },
    { id: 'app-3', sessionId: 's-1', direction: 'APPLY', applicantId: 'u-03', teamId: 't-1', message: '백엔드 지원합니다. 주말에 집중해서 할 수 있어요.', status: 'PENDING', createdAt: hoursAgo(20) },
    { id: 'app-4', sessionId: 's-1', direction: 'APPLY', applicantId: 'u-07', teamId: 't-1', message: '기획과 일정 관리를 맡고 싶어요.', status: 'PENDING', createdAt: hoursAgo(5) },
  ],
  tasks: seedTasks(),
  schedules: seedSchedules(),
  chatRooms: [
    { id: 'cr-t1', workspaceId: 'ws-1', kind: 'TEAM', title: '알파팀 채팅방', teamId: 't-1', memberIds: [], createdBy: 'u-01', createdAt: hoursAgo(130) },
    { id: 'cr-t2', workspaceId: 'ws-1', kind: 'TEAM', title: '데이터 크루 채팅방', teamId: 't-2', memberIds: [], createdBy: 'u-05', createdAt: hoursAgo(260) },
    { id: 'cr-t3', workspaceId: 'ws-1', kind: 'TEAM', title: '달빛 채팅방', teamId: 't-3', memberIds: [], createdBy: 'u-08', createdAt: hoursAgo(150) },
    { id: 'cr-dm1', workspaceId: 'ws-1', kind: 'DM', memberIds: ['u-01', 'u-02'], createdBy: 'u-01', createdAt: hoursAgo(50) },
    { id: 'cr-g1', workspaceId: 'ws-1', kind: 'GROUP', title: '백엔드 스터디', memberIds: ['u-01', 'u-03', 'u-student'], createdBy: 'u-01', createdAt: hoursAgo(40) },
  ],
  chatMessages: [
    { id: 'm-1', roomId: 'cr-t1', content: '알파팀 채팅방이 만들어졌어요.', createdAt: hoursAgo(130) },
    { id: 'm-2', roomId: 'cr-t1', authorId: 'u-01', content: '안녕하세요! 이번 주 목요일 저녁에 첫 회의 어때요?', createdAt: hoursAgo(73) },
    { id: 'm-3', roomId: 'cr-t1', authorId: 'u-02', content: '좋아요. 화면 흐름도는 그 전에 공유할게요.', createdAt: hoursAgo(72) },
    { id: 'm-4', roomId: 'cr-t1', authorId: 'u-02', content: 'DB 스키마 완료 요청 보냈어요. 확인 부탁드려요.', createdAt: hoursAgo(4) },
    { id: 'm-5', roomId: 'cr-dm1', authorId: 'u-02', content: '프로필 화면 디자인 시안 봐 주실 수 있나요?', createdAt: hoursAgo(26) },
    { id: 'm-6', roomId: 'cr-dm1', authorId: 'u-01', content: '네, 오늘 밤에 볼게요.', createdAt: hoursAgo(25) },
    { id: 'm-7', roomId: 'cr-g1', authorId: 'u-01', content: '스프링 시큐리티 같이 공부하실 분들 모였어요.', createdAt: hoursAgo(40) },
    { id: 'm-8', roomId: 'cr-g1', authorId: 'u-03', content: '저 JWT 부분 정리해 올게요.', createdAt: hoursAgo(10) },
  ],
  chatReads: { 'cr-t1:u-01': hoursAgo(71), 'cr-dm1:u-01': hoursAgo(25), 'cr-g1:u-01': hoursAgo(20) },
  chatMutes: [],
  videoChannels: [
    { id: 'vc-t1', workspaceId: 'ws-1', teamId: 't-1', name: '알파팀 회의실' },
    { id: 'vc-t2', workspaceId: 'ws-1', teamId: 't-2', name: '데이터 크루 회의실' },
    { id: 'vc-t3', workspaceId: 'ws-1', teamId: 't-3', name: '달빛 회의실' },
  ],
  videoPresence: [{ channelId: 'vc-t1', accountId: 'u-02', joinedAt: hoursAgo(0.2) }],
  notifications: [
    { id: 'n-1', accountId: 'u-student', workspaceId: 'ws-1', type: 'TB_SCOUT_RECEIVED', category: 'TEAM_BUILDING', priority: 'HIGH', title: '달빛에서 스카우트를 보냈어요.', link: '/ws/ws-1/team-building/inbox', read: false, createdAt: hoursAgo(2) },
    { id: 'n-2', accountId: 'u-student', workspaceId: 'ws-1', type: 'TB_SESSION_OPENED', category: 'TEAM_BUILDING', priority: 'HIGH', title: '팀 빌딩 모집이 시작됐어요. 마음에 드는 팀을 찾아보세요.', link: '/ws/ws-1/team-building', read: true, createdAt: hoursAgo(80) },
    { id: 'n-3', accountId: 'u-01', workspaceId: 'ws-1', type: 'TB_APPLICATION_RECEIVED', category: 'TEAM_BUILDING', priority: 'HIGH', title: '윤지호님이 알파팀에 지원했어요.', link: '/ws/ws-1/team-building/inbox', read: false, createdAt: hoursAgo(5) },
    { id: 'n-4', accountId: 'u-01', workspaceId: 'ws-1', type: 'KANBAN_TASK_COMPLETION_REQUESTED', category: 'KANBAN', priority: 'HIGH', title: '이영희님이 “DB 스키마 설계” 완료 승인을 요청했어요.', link: '/ws/ws-1/team/t-1/kanban?task=k-5', read: false, createdAt: hoursAgo(5) },
    { id: 'n-5', accountId: 'u-01', workspaceId: 'ws-1', type: 'TB_APPLICATION_RECEIVED', category: 'TEAM_BUILDING', priority: 'HIGH', title: '박민준님이 알파팀에 지원했어요.', link: '/ws/ws-1/team-building/inbox', read: true, createdAt: hoursAgo(20) },
    { id: 'n-6', accountId: 'u-instructor', workspaceId: 'ws-1', type: 'WS_MEMBER_JOINED', category: 'MEMBERSHIP', priority: 'LOW', title: '강도윤님이 워크스페이스에 합류했어요.', link: '/ws/ws-1/dashboard', read: false, createdAt: hoursAgo(30) },
  ],
  notificationSettings: {},
  workspaceSeenAt: {},
  sentTimedEvents: [],
  posts: [
    {
      id: 'p-1',
      teamId: 't-1',
      title: '회의록: 1주차 킥오프',
      content: '역할 분담\n- 김철수: 백엔드, 인증\n- 이영희: 프론트엔드, 디자인\n\n다음 회의까지 각자 맡은 화면의 흐름도를 그려 오기로 했어요.',
      authorId: 'u-01',
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(96),
      comments: [{ id: 'pc-1', authorId: 'u-02', content: '흐름도는 피그마에 올려 둘게요.', createdAt: hoursAgo(90) }],
    },
    {
      id: 'p-2',
      teamId: 't-1',
      title: '참고 자료 모음',
      content: '디자인 시스템 레퍼런스와 API 설계 가이드를 정리했어요.',
      authorId: 'u-02',
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(30),
      comments: [],
    },
  ],
  rolesConfirmedTeamIds: ['t-1', 't-2', 't-3'],
  bans: [{ workspaceId: 'ws-1', accountId: 'u-12', bannedAt: hoursAgo(24 * 4) }],
  reminders: [],
  credentials: Object.fromEntries(people.map(([id]) => [id, { passwordHash: SEED_PASSWORD_HASH }])),
  policyConsents: Object.fromEntries(people.map(([id]) => [id, { version: '2026-10-01', agreedAt: '2026-10-01T09:00:00.000Z' }])),
  verifications: [],
  // 시연용 신고 한 건. 박민준이 백엔드 스터디 방의 메시지를 신고했다.
  reports: [
    {
      id: 'rp-1',
      reporterId: 'u-03',
      targetType: 'MESSAGE',
      targetId: 'm-7',
      workspaceId: 'ws-1',
      targetAccountId: 'u-01',
      snapshot: '스프링 시큐리티 같이 공부하실 분들 모였어요.',
      reason: 'SPAM',
      detail: '같은 홍보 메시지를 여러 방에 반복해서 올려요.',
      status: 'RECEIVED',
      createdAt: hoursAgo(3),
    },
  ],
  invites: [
    { workspaceId: 'ws-1', code: 'SUMMER26', expiresAt: daysFromNow(30), active: true, usedCount: 14 },
    { workspaceId: 'ws-1', code: 'SPRING26', expiresAt: daysFromNow(-1), active: true, usedCount: 3 },
    { workspaceId: 'ws-2', code: 'ALGO2026', expiresAt: null, active: true, usedCount: 2 },
    { workspaceId: 'ws-3', code: 'UXSTUDY', expiresAt: daysFromNow(14), active: true, usedCount: 1 },
    { workspaceId: 'ws-3', code: 'UXOLD', expiresAt: null, active: false, usedCount: 5 },
  ],
  oauthLinks: [],
  announcements: [
    {
      id: 'a-1',
      workspaceId: 'ws-1',
      title: '팀 빌딩 마감 시각 안내',
      content: '팀 빌딩은 이번 주 일요일 밤 11시 59분에 마감해요. 마감 전에 팀을 정하지 못한 분은 운영진이 남은 자리에 배정해요.',
      authorId: 'u-instructor',
      authorName: '박강사',
      createdAt: hoursAgo(1),
    },
    {
      id: 'a-2',
      workspaceId: 'ws-1',
      title: 'PR 카드 작성 가이드: 희망 역할과 태그 쓰는 법',
      content: '희망 역할은 가장 하고 싶은 일을 1순위로 적어 주세요. 태그는 써 본 기술 위주로 다섯 개 안팎이면 충분해요.',
      authorId: 'u-manager',
      authorName: '정매니저',
      createdAt: hoursAgo(26),
    },
    {
      id: 'a-3',
      workspaceId: 'ws-1',
      title: '알파팀 첫 회의 일정',
      authorName: '김철수',
      authorId: 'u-01',
      teamName: '알파팀',
      teamId: 't-1',
      content: '첫 회의는 목요일 저녁 8시에 온라인으로 해요. 각자 맡고 싶은 기능을 하나씩 생각해 와 주세요.',
      createdAt: hoursAgo(72),
    },
  ],
  teams: [
    {
      id: 't-1',
      workspaceId: 'ws-1',
      name: '알파팀',
      leaderId: 'u-01',
      memberIds: ['u-01', 'u-02'],
      intro: '실서비스 수준까지 만들어 보고 싶어요.',
      goalTemperature: 4,
      recruitRoles: [
        { role: 'BACKEND', count: 1, note: 'Spring Boot 경험 우대' },
        { role: 'PM', count: 1 },
      ],
    },
    {
      id: 't-2',
      workspaceId: 'ws-1',
      name: '데이터 크루',
      leaderId: 'u-05',
      memberIds: ['u-04', 'u-05'],
      intro: '데이터로 문제를 푸는 서비스를 만들어요.',
      goalTemperature: 5,
      recruitRoles: [{ role: 'BACKEND', count: 1 }, { role: 'DESIGN', count: 1 }],
    },
    {
      id: 't-3',
      workspaceId: 'ws-1',
      name: '달빛',
      leaderId: 'u-08',
      memberIds: ['u-08', 'u-06'],
      intro: '끝까지 완성하는 것이 목표예요.',
      goalTemperature: 3,
      recruitRoles: [{ role: 'FRONTEND', count: 1 }, { role: 'BACKEND', count: 1 }],
    },
  ],
});

const read = (): MockDb => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === VERSION) return parsed;
    }
  } catch {
    // 저장소를 쓸 수 없거나 손상된 경우 초기 데이터로 시작한다.
  }
  return seed();
};

let db: MockDb = read();
// 처음 실행하면 초기 데이터를 바로 저장해 새로고침 후에도 같은 상태로 시작한다.
try {
  if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
} catch {
  // 저장하지 못해도 메모리에서 동작한다.
}

export const getDb = () => db;

export const commit = (next: MockDb) => {
  db = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 시크릿 모드 등에서 저장하지 못해도 메모리에서는 계속 동작한다.
  }
};

export const resetDb = () => commit(seed());

/** 실제 네트워크와 비슷한 지연 */
export const latency = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 오류 상태 확인용 스위치: localStorage `pickteam.renewal.mock.fail`에 쉼표로 구분한 작업 이름을 넣으면 해당 호출이 실패한다.
 * 예) members,saveCard
 */
export const shouldFail = (operation: string) => {
  try {
    return (localStorage.getItem('pickteam.renewal.mock.fail') ?? '').split(',').map((v) => v.trim()).includes(operation);
  } catch {
    return false;
  }
};
