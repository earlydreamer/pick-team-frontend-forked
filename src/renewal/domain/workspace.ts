import type { PrCard } from './card';

/**
 * 다른 멤버가 보는 카드 상태(11 §5.2, 11-D3).
 * PUBLIC만 내용을 담고, PRIVATE와 NOT_WRITTEN은 이름·사진만 보인다.
 */
export type MemberCardState = 'PUBLIC' | 'PRIVATE' | 'NOT_WRITTEN';

/** 00 §3 액터: 워크스페이스 역할 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export const WORKSPACE_ROLE_LABEL: Record<WorkspaceRole, string> = { OWNER: '개설자', ADMIN: '매니저', MEMBER: '멤버' };
export const isManager = (role?: WorkspaceRole) => role === 'OWNER' || role === 'ADMIN';

export interface Account {
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  iconUrl?: string | null;
  memberCount: number;
  myRole: WorkspaceRole;
}

export interface Member {
  account: Account;
  role: WorkspaceRole;
  /** 내 팀(결성된 팀) id. 없으면 미배정 */
  teamId?: string;
  cardState: MemberCardState;
  card: PrCard;
}
