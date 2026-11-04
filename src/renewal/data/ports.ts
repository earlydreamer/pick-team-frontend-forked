import type { PrCard } from '@/renewal/domain/card';
import type { Account, Member, Workspace } from '@/renewal/domain/workspace';
import type {
  CreateTeamInput,
  Inbox,
  RandomAssignResult,
  Recommendation,
  SessionManageView,
  SessionSettingsInput,
  Team,
  TeamBuildingBoard,
  TeamBuildingSession,
  TeamDetail,
} from '@/renewal/domain/teamBuilding';
import type { DashboardView } from '@/renewal/domain/dashboard';
import type { KanbanTask, TaskAction, TaskInput } from '@/renewal/domain/kanban';
import type { Schedule, TeamInfoInput, TeamOverview, TeamSpace } from '@/renewal/domain/teamSpace';
import type { AnnouncementInput, Post, PostInput, ScheduleInput, TeamAnnouncement } from '@/renewal/domain/collab';
import type { Account as ChatAccount } from '@/renewal/domain/workspace';
import type { ChatMessage, ChatRoom, ChatRoomSummary, VideoChannel } from '@/renewal/domain/chat';
import type { AppNotification, NotificationCategory, NotificationSettings } from '@/renewal/domain/notification';
import type { Announcement } from '@/renewal/domain/announcement';
import type { BannedMember, InviteView, WorkspaceSettings } from '@/renewal/domain/workspaceAdmin';
import type { CreateWorkspaceInput, InviteInfo, JoinResult, OAuthProvider, SignUpInput } from '@/renewal/domain/auth';

/**
 * 화면이 의존하는 데이터 포트.
 * 화면은 이 계약만 알고, 목 어댑터(지금)와 http 어댑터(백엔드 리뉴얼 API 이후)가 같은 계약을 구현한다.
 */

/** CARD_REQUIRED: 공개 카드가 있어야 하는 행동(지원 등)을 카드 없이 시도함(01-D1, 11-D5) */
/** GONE: 있었지만 더 쓸 수 없음(만료된 초대 링크·인증 코드, HTTP 410) */
export type DataErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'GONE' | 'CONFLICT' | 'INVALID' | 'CARD_REQUIRED' | 'NETWORK' | 'UNKNOWN';

export class DataError extends Error {
  constructor(message: string, public readonly code: DataErrorCode) {
    super(message);
    this.name = 'DataError';
  }
}

export interface SessionPort {
  /** 로그인한 계정. 없으면 null */
  me(): Promise<Account | null>;
  signOut(): Promise<void>;

  /* 인증(10 §4.1~§4.3, §6.1). 오류 문구는 계정 존재 여부를 드러내지 않는다. */
  signIn(email: string, password: string): Promise<Account>;
  /** 가입 이메일 인증 코드 발송. 이미 가입된 이메일이면 CONFLICT */
  requestSignupCode(email: string): Promise<void>;
  /** 틀린 코드는 INVALID, 5분이 지난 코드는 GONE */
  verifySignupCode(email: string, code: string): Promise<void>;
  /** 인증을 마친 이메일로 계정을 만들고 바로 로그인한다 */
  signUp(input: SignUpInput): Promise<Account>;
  requestPasswordReset(email: string): Promise<void>;
  verifyResetCode(email: string, code: string): Promise<void>;
  /** 성공하면 코드를 지워 다시 쓸 수 없다 */
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;
  /** OAuth 제공자 인증 화면 주소. 인증을 마치면 /oauth/callback?provider=&code= 로 돌아온다 */
  oauthStartUrl(provider: OAuthProvider): string;
  /** 임시 코드를 교환해 로그인한다. 같은 이메일의 이메일 계정이 있으면 CONFLICT(10-D3) */
  oauthExchange(provider: OAuthProvider, code: string): Promise<Account>;
  /** 프로필 사진 변경. null이면 삭제한다 */
  updateProfileImage(file: File | null): Promise<Account>;
}

export interface WorkspacePort {
  listMine(): Promise<Workspace[]>;
  /** 워크스페이스 만들기. 만든 사람이 개설자가 된다 */
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  get(workspaceId: string): Promise<Workspace>;
  /** 갤러리용 멤버 목록. 비공개·미작성 카드는 카드 내용 없이 상태만 담는다(11 §5.2, 11-D3) */
  listMembers(workspaceId: string): Promise<Member[]>;
  getMember(workspaceId: string, accountId: string): Promise<Member>;
}

export interface CardPort {
  getMine(): Promise<PrCard>;
  /** 전체 저장. 최초 동의 시각은 서버가 기록한다 */
  saveMine(card: PrCard): Promise<PrCard>;
  setVisibility(visible: boolean): Promise<PrCard>;
  searchHashtags(keyword: string): Promise<string[]>;
}

export interface TeamBuildingPort {
  /** 워크스페이스에 세션이 없으면 null(팀 빌딩 OFF) */
  getSession(workspaceId: string): Promise<TeamBuildingSession | null>;
  listTeams(workspaceId: string): Promise<Team[]>;
  /** SCR-TB-01: 세션, 내 상태, 모집 팀 목록 */
  getBoard(workspaceId: string): Promise<TeamBuildingBoard>;
  getTeamDetail(workspaceId: string, teamId: string): Promise<TeamDetail>;
  /** 매칭 v1 추천(12 §5.3). 내가 팀이 없으면 팀 추천, 팀이 있으면 사람 추천 */
  recommendations(workspaceId: string): Promise<Recommendation[]>;
  inbox(workspaceId: string): Promise<Inbox>;
  apply(workspaceId: string, teamId: string, message?: string): Promise<void>;
  scout(workspaceId: string, accountId: string, message?: string): Promise<void>;
  accept(workspaceId: string, applicationId: string): Promise<void>;
  decline(workspaceId: string, applicationId: string): Promise<void>;
  withdraw(workspaceId: string, applicationId: string): Promise<void>;
  createTeam(workspaceId: string, input: CreateTeamInput): Promise<{ teamId: string }>;

  /* 세션 운영(SCR-TB-04). 모두 개설자·매니저 전용이며 멤버가 부르면 FORBIDDEN이다. */
  getManageView(workspaceId: string): Promise<SessionManageView>;
  createSession(workspaceId: string, input: SessionSettingsInput): Promise<void>;
  /** DRAFT는 마감과 정원, OPEN은 마감 연장만 바꾼다 */
  updateSession(workspaceId: string, input: SessionSettingsInput): Promise<void>;
  openSession(workspaceId: string): Promise<void>;
  /** 지금 마감: OPEN → CLOSING, 대기 제안은 만료 */
  closeSession(workspaceId: string): Promise<void>;
  assignMember(workspaceId: string, accountId: string, teamId: string): Promise<void>;
  unassignMember(workspaceId: string, accountId: string): Promise<void>;
  addTeamSlot(workspaceId: string, name: string): Promise<{ teamId: string }>;
  randomAssign(workspaceId: string): Promise<RandomAssignResult>;
  /** 결과 확정: CLOSING → RESOLVED, 되돌릴 수 없다(12-D5) */
  resolveSession(workspaceId: string): Promise<void>;
}

/**
 * 팀 스페이스(14). 팀원이 아니면 NOT_FOUND로 존재를 숨기고,
 * 팀원이 아닌 개설자·매니저는 집계와 칸반 승인만 할 수 있다(13-D1, 14 §2).
 */
export interface TeamSpacePort {
  get(workspaceId: string, teamId: string): Promise<TeamSpace>;
  /** SCR-TM-01 집계(14 §6.1). 매니저에게는 일정·공지를 담지 않는다 */
  overview(workspaceId: string, teamId: string): Promise<TeamOverview>;
  /** 결성 직후 체크리스트의 "역할 확정" 완료 표시(팀장) */
  confirmRoles(workspaceId: string, teamId: string): Promise<void>;
  listTasks(workspaceId: string, teamId: string): Promise<KanbanTask[]>;
  createTask(workspaceId: string, teamId: string, input: TaskInput): Promise<{ taskId: string }>;
  /** 담당자가 팀원이 아니면 INVALID(14 §4.2) */
  updateTask(workspaceId: string, teamId: string, taskId: string, input: TaskInput): Promise<void>;
  /** note는 완료 요청 메시지 또는 반려 사유 */
  transitionTask(workspaceId: string, teamId: string, taskId: string, action: TaskAction, note?: string): Promise<void>;
  deleteTask(workspaceId: string, teamId: string, taskId: string): Promise<void>;
  addComment(workspaceId: string, teamId: string, taskId: string, content: string): Promise<void>;

  /* 일정(SCR-TM-03). 팀 일정과 내 개인 일정만 돌려준다(14 §5.3) */
  listSchedules(workspaceId: string, teamId: string): Promise<Schedule[]>;
  createSchedule(workspaceId: string, teamId: string, input: ScheduleInput): Promise<{ scheduleId: string }>;
  updateSchedule(workspaceId: string, teamId: string, scheduleId: string, input: ScheduleInput): Promise<void>;
  deleteSchedule(workspaceId: string, teamId: string, scheduleId: string): Promise<void>;

  /* 게시판(SCR-TM-04). 첨부 파일은 http 어댑터에서 기존 PostAttachController로 연결한다 */
  listPosts(workspaceId: string, teamId: string): Promise<Post[]>;
  createPost(workspaceId: string, teamId: string, input: PostInput): Promise<{ postId: string }>;
  updatePost(workspaceId: string, teamId: string, postId: string, input: PostInput): Promise<void>;
  deletePost(workspaceId: string, teamId: string, postId: string): Promise<void>;
  addPostComment(workspaceId: string, teamId: string, postId: string, content: string): Promise<void>;
  deletePostComment(workspaceId: string, teamId: string, postId: string, commentId: string): Promise<void>;

  /* 팀 공지(SCR-TM-05). 쓰기는 팀장만 */
  listAnnouncements(workspaceId: string, teamId: string): Promise<TeamAnnouncement[]>;
  createAnnouncement(workspaceId: string, teamId: string, input: AnnouncementInput): Promise<{ announcementId: string }>;
  updateAnnouncement(workspaceId: string, teamId: string, announcementId: string, input: AnnouncementInput): Promise<void>;
  deleteAnnouncement(workspaceId: string, teamId: string, announcementId: string): Promise<void>;

  /* 팀 설정(SCR-TM-06, 14 §6.6) */
  updateTeamInfo(workspaceId: string, teamId: string, input: TeamInfoInput): Promise<void>;
  /** 팀장 위임 지명. 진행 중인 요청이 있으면 CONFLICT */
  requestDelegation(workspaceId: string, teamId: string, targetId: string): Promise<void>;
  cancelDelegation(workspaceId: string, teamId: string): Promise<void>;
  /** 지명된 팀원의 응답. 24시간이 지나면 GONE */
  respondDelegation(workspaceId: string, teamId: string, accept: boolean): Promise<void>;
  /** 팀장·매니저 전용. 팀장은 내보낼 수 없다 */
  removeMember(workspaceId: string, teamId: string, accountId: string): Promise<void>;
  /** 혼자 남은 팀장이 나가면 팀을 해체하고 disbanded=true */
  leaveTeam(workspaceId: string, teamId: string): Promise<{ disbanded: boolean }>;
  /** 팀 이름을 그대로 입력해야 한다(14 §5.5) */
  deleteTeam(workspaceId: string, teamId: string, confirmName: string): Promise<void>;
}

export interface ChatRoomDetail {
  room: ChatRoom;
  title: string;
  members: ChatAccount[];
  muted: boolean;
  permissions: { rename: boolean; addMembers: boolean; leave: boolean; delete: boolean };
}

/**
 * 채팅(15 §4.1, §6.1). 목업은 주기 조회로 새 메시지를 가져오고, http 어댑터는 기존 SSE(CHAT_MESSAGE_RECEIVED,
 * CHAT_MEMBER_JOINED/LEFT)를 받아 같은 쿼리를 갱신한다. 멤버가 아닌 방은 NOT_FOUND로 숨긴다.
 */
export interface ChatPort {
  listRooms(workspaceId: string): Promise<ChatRoomSummary[]>;
  getRoom(workspaceId: string, roomId: string): Promise<ChatRoomDetail>;
  listMessages(workspaceId: string, roomId: string): Promise<ChatMessage[]>;
  sendMessage(workspaceId: string, roomId: string, content: string): Promise<ChatMessage>;
  markRead(workspaceId: string, roomId: string): Promise<void>;
  searchMessages(workspaceId: string, roomId: string, keyword: string): Promise<ChatMessage[]>;
  /** 한 명만 고르고 이름이 없으면 DM으로 연다 */
  createRoom(workspaceId: string, input: { title?: string; memberIds: string[] }): Promise<{ roomId: string }>;
  /** 이미 있는 DM이면 그 방을 돌려준다(15 US-15-01) */
  openDm(workspaceId: string, accountId: string): Promise<{ roomId: string }>;
  renameRoom(workspaceId: string, roomId: string, title: string): Promise<void>;
  addMembers(workspaceId: string, roomId: string, memberIds: string[]): Promise<void>;
  leaveRoom(workspaceId: string, roomId: string): Promise<void>;
  deleteRoom(workspaceId: string, roomId: string): Promise<void>;
  setMuted(workspaceId: string, roomId: string, muted: boolean): Promise<void>;
}

/**
 * 화상회의(15 §4.3, §6.2). 실제 영상 연결은 LiveKit이 맡는다. http 어댑터는 LiveKit 토큰을 응답 본문으로 받아
 * SDK에 넘기고, URL 쿼리에 토큰을 싣지 않는다(15-D5).
 */
export interface VideoPort {
  listChannels(workspaceId: string): Promise<VideoChannel[]>;
  getChannel(workspaceId: string, channelId: string): Promise<{ channel: VideoChannel; participants: ChatAccount[] }>;
  join(workspaceId: string, channelId: string): Promise<void>;
  /** 나가면 참여 기록(VideoMember)을 지운다 */
  leave(workspaceId: string, channelId: string): Promise<void>;
}

/**
 * 알림(16 §7.2). 계정 단위이며 워크스페이스를 가리지 않는다. 목업은 주기 조회로 새 알림을 가져오고,
 * http 어댑터는 SSE 알림 이벤트를 받을 때 같은 쿼리를 갱신한다.
 */
export interface NotificationPort {
  /** 최신순. limit만큼 돌려주고 더 있는지 알려 준다(20건 단위 더 보기) */
  list(input: { category?: NotificationCategory; limit: number }): Promise<{ items: AppNotification[]; hasMore: boolean }>;
  /** 벨 배지와 WS 레일 배지(16 §6.2) */
  unreadSummary(): Promise<{ total: number; byWorkspace: Record<string, number> }>;
  /** 워크스페이스에 들어왔다. 그 워크스페이스의 레일 배지를 0으로 돌린다(16-D5) */
  markWorkspaceSeen(workspaceId: string): Promise<void>;
  markRead(id: string): Promise<void>;
  /** category를 주면 그 계열만 읽음 처리한다 */
  markAllRead(category?: NotificationCategory): Promise<void>;
  remove(id: string): Promise<void>;
  getSettings(): Promise<NotificationSettings>;
  updateSettings(settings: NotificationSettings): Promise<void>;
}

/**
 * 워크스페이스 설정(SCR-WS-03, 13 §6.2). 권한은 서버가 워크스페이스 역할로 판정하고 FORBIDDEN을 돌려준다.
 * 내보내기·차단은 팀, 채팅, 대기 지원 정리를 서버 트랜잭션 안에서 함께 한다(13 §5.1).
 */
export interface WorkspaceAdminPort {
  getSettings(workspaceId: string): Promise<WorkspaceSettings>;
  rename(workspaceId: string, name: string): Promise<void>;
  /** 재발급하면 이전 링크는 바로 무효가 된다. days가 null이면 만료 없음 */
  refreshInvite(workspaceId: string, days: number | null): Promise<InviteView>;
  changeRole(workspaceId: string, accountId: string, role: 'ADMIN' | 'MEMBER'): Promise<void>;
  /** 받는 사람 이름을 그대로 입력해야 한다(13 §5.3) */
  transferOwnership(workspaceId: string, accountId: string, confirmName: string): Promise<void>;
  kick(workspaceId: string, accountId: string): Promise<void>;
  ban(workspaceId: string, accountId: string): Promise<void>;
  listBans(workspaceId: string): Promise<BannedMember[]>;
  unban(workspaceId: string, accountId: string): Promise<void>;
  /** null이면 비밀번호를 없앤다 */
  setPassword(workspaceId: string, password: string | null): Promise<void>;
  leave(workspaceId: string): Promise<void>;
  /** 워크스페이스 이름을 그대로 입력해야 한다 */
  remove(workspaceId: string, confirmName: string): Promise<void>;
}

/** 초대 링크(10 §4.4, §6.2). 조회는 로그인하지 않아도 된다. */
export interface InvitePort {
  /** 없는 코드는 NOT_FOUND, 만료·재발급된 코드는 GONE */
  get(code: string): Promise<InviteInfo>;
  /** 로그인 필요. 차단·정원 초과는 FORBIDDEN, 비밀번호 오류는 INVALID */
  join(code: string, password?: string): Promise<JoinResult>;
}

/** 강사 대시보드(SCR-DSH-01). 개설자·매니저 전용이다. */
export interface DashboardPort {
  get(workspaceId: string): Promise<DashboardView>;
  /** 진행도 승인. 승인자는 요청한 계정으로 기록한다(00 §3.2 규칙 2). */
  approve(workspaceId: string, approvalId: string): Promise<void>;
  /** 카드 미작성 참여 대상에게 리마인드를 보내고 보낸 인원을 돌려준다 */
  remindCardWriters(workspaceId: string): Promise<{ count: number }>;
}

export interface AnnouncementPort {
  /** 워크스페이스에서 내가 볼 수 있는 최근 공지(최신순) */
  listRecent(workspaceId: string, limit: number): Promise<Announcement[]>;
}

export interface DataSource {
  kind: 'mock' | 'http';
  session: SessionPort;
  workspaces: WorkspacePort;
  workspaceAdmin: WorkspaceAdminPort;
  cards: CardPort;
  teamBuilding: TeamBuildingPort;
  dashboard: DashboardPort;
  invites: InvitePort;
  teamSpace: TeamSpacePort;
  chat: ChatPort;
  video: VideoPort;
  notifications: NotificationPort;
  announcements: AnnouncementPort;
}
