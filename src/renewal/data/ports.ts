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
import type { Announcement } from '@/renewal/domain/announcement';
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
  cards: CardPort;
  teamBuilding: TeamBuildingPort;
  dashboard: DashboardPort;
  invites: InvitePort;
  announcements: AnnouncementPort;
}
