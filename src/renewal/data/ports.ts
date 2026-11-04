import type { PrCard } from '@/renewal/domain/card';
import type { Account, Member, Workspace } from '@/renewal/domain/workspace';
import type { CreateTeamInput, Inbox, Recommendation, Team, TeamBuildingBoard, TeamBuildingSession, TeamDetail } from '@/renewal/domain/teamBuilding';
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
  announcements: AnnouncementPort;
}
