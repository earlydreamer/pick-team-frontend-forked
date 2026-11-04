import type { Account, WorkspaceRole } from './workspace';

/**
 * 워크스페이스 설정(SCR-WS-03). 근거: docs/renewal/spec/13-workspace-admin.md §2, §4.1~§4.3, §5.2, §5.3.
 * 권한 판정은 워크스페이스 역할 하나로 한다(13 §6.3).
 */

export type SettingsTab = 'general' | 'invite' | 'members' | 'bans' | 'security' | 'danger';

export const SETTINGS_TABS: { id: SettingsTab; label: string; roles: WorkspaceRole[] }[] = [
  { id: 'general', label: '일반', roles: ['OWNER', 'ADMIN', 'MEMBER'] },
  { id: 'invite', label: '초대', roles: ['OWNER', 'ADMIN'] },
  { id: 'members', label: '멤버 관리', roles: ['OWNER', 'ADMIN'] },
  { id: 'bans', label: '차단 목록', roles: ['OWNER', 'ADMIN'] },
  { id: 'security', label: '보안', roles: ['OWNER'] },
  { id: 'danger', label: '위험 구역', roles: ['OWNER'] },
];

/** 내 역할로 열 수 있는 탭(13 §4.1 탭별 접근 권한) */
export const tabsFor = (role: WorkspaceRole) => SETTINGS_TABS.filter((tab) => tab.roles.includes(role));

export interface InviteView {
  code: string;
  /** null이면 만료 없음 */
  expiresAt: string | null;
  usedCount: number;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  myRole: WorkspaceRole;
  memberCount: number;
  /** 정원. 없으면 제한 없음 */
  capacity?: number;
  hasPassword: boolean;
  /** 현재 초대 링크. 매니저 이상에게만 내려 준다. 만료됐으면 expired가 참이다 */
  invite: (InviteView & { expired: boolean }) | null;
}

export interface BannedMember {
  account: Account;
  bannedAt: string;
}

/** 재발급 만료 기간. 기본 30일, "만료 없음"은 명시적으로 고른다(10-D2, 13-D3). */
export const INVITE_EXPIRY_OPTIONS: { value: string; days: number | null; label: string }[] = [
  { value: '30', days: 30, label: '30일 뒤 만료' },
  { value: '7', days: 7, label: '7일 뒤 만료' },
  { value: 'none', days: null, label: '만료 없음' },
];

export const inviteUrl = (code: string, origin = typeof window === 'undefined' ? '' : window.location.origin) => `${origin}/invite/${code}`;

export interface MemberActions {
  promote: boolean;
  demote: boolean;
  transfer: boolean;
  kick: boolean;
  ban: boolean;
}

/**
 * 멤버 행에서 할 수 있는 일(13 §4.3, §5.2).
 * 자기 자신과 개설자에게는 아무것도 할 수 없다. 역할 변경과 이양은 개설자만 한다.
 * 매니저는 멤버만 내보내거나 차단한다. 매니저끼리 서로 내보내지 못하게 해 운영 권한 다툼을 막는다.
 */
export const memberActions = (myRole: WorkspaceRole, myId: string, target: { accountId: string; role: WorkspaceRole }): MemberActions => {
  const none = { promote: false, demote: false, transfer: false, kick: false, ban: false };
  if (target.accountId === myId || target.role === 'OWNER' || myRole === 'MEMBER') return none;
  const owner = myRole === 'OWNER';
  const removable = owner || target.role === 'MEMBER';
  return { promote: owner && target.role === 'MEMBER', demote: owner && target.role === 'ADMIN', transfer: owner, kick: removable, ban: removable };
};

/** 이름·이메일 검색(13 §4.3). 대소문자를 가리지 않는다. */
export const matchesMember = (account: Account, query: string) => {
  const keyword = query.trim().toLowerCase();
  return !keyword || account.name.toLowerCase().includes(keyword) || account.email.toLowerCase().includes(keyword);
};
