import type { PrCard } from '@/renewal/domain/card';
import type { Account, Member, Workspace } from '@/renewal/domain/workspace';
import type { Team, TeamBuildingSession } from '@/renewal/domain/teamBuilding';

/**
 * 화면이 의존하는 데이터 포트.
 * 화면은 이 계약만 알고, 목 어댑터(지금)와 http 어댑터(백엔드 리뉴얼 API 이후)가 같은 계약을 구현한다.
 */

export type DataErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID' | 'NETWORK' | 'UNKNOWN';

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
}

export interface DataSource {
  kind: 'mock' | 'http';
  session: SessionPort;
  workspaces: WorkspacePort;
  cards: CardPort;
  teamBuilding: TeamBuildingPort;
}
