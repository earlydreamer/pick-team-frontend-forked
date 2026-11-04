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

/**
 * 화면이 의존하는 데이터 포트.
 * 화면은 이 계약만 알고, 목 어댑터(지금)와 http 어댑터(백엔드 리뉴얼 API 이후)가 같은 계약을 구현한다.
 */

/** CARD_REQUIRED: 공개 카드가 있어야 하는 행동(지원 등)을 카드 없이 시도함(01-D1, 11-D5) */
export type DataErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID' | 'CARD_REQUIRED' | 'NETWORK' | 'UNKNOWN';

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
  /** 프로필 사진 변경. null이면 삭제한다 */
  updateProfileImage(file: File | null): Promise<Account>;
}

export interface WorkspacePort {
  listMine(): Promise<Workspace[]>;
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
  announcements: AnnouncementPort;
}
