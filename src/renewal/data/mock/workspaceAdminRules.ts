import { validateWorkspaceName, validateWorkspacePassword } from '@/renewal/domain/auth';
import { memberActions } from '@/renewal/domain/workspaceAdmin';
import type { WorkspaceRole } from '@/renewal/domain/workspace';
import { DataError } from '../ports';
import type { MockDb, MockWorkspace } from './db';
import { hashPassword } from './authRules';
import { detach, disband } from './teamSettingsRules';
import { findSession } from './rules';

/*
 * 워크스페이스 설정 규칙(13 §2, §4.2, §4.3, §5.1~§5.3).
 *
 * | 행동 | 할 수 있는 사람 |
 * |---|---|
 * | 이름 수정, 초대 링크 재발급, 내보내기·차단·차단 해제 | 개설자, 매니저(매니저는 멤버에게만) |
 * | 매니저 임명·해제, 개설자 넘기기, 비밀번호, 워크스페이스 삭제 | 개설자 |
 * | 워크스페이스 나가기 | 개설자가 아닌 사람. 개설자는 넘긴 뒤에 나간다 |
 */

const now = () => new Date().toISOString();
const randomCode = () => `INV-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

const workspaceOf = (db: MockDb, workspaceId: string) => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  return workspace;
};

const roleOf = (workspace: MockWorkspace, accountId: string) => {
  const member = workspace.members.find((item) => item.accountId === accountId);
  if (!member) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  return member.role;
};

const requireRole = (db: MockDb, workspaceId: string, accountId: string, roles: WorkspaceRole[], message: string) => {
  const workspace = workspaceOf(db, workspaceId);
  if (!roles.includes(roleOf(workspace, accountId))) throw new DataError(message, 'FORBIDDEN');
  return workspace;
};
const requireManager = (db: MockDb, workspaceId: string, accountId: string) => requireRole(db, workspaceId, accountId, ['OWNER', 'ADMIN'], '개설자와 매니저만 할 수 있어요.');
const requireOwner = (db: MockDb, workspaceId: string, accountId: string) => requireRole(db, workspaceId, accountId, ['OWNER'], '개설자만 할 수 있어요.');

const replaceWorkspace = (db: MockDb, workspaceId: string, patch: (workspace: MockWorkspace) => MockWorkspace): MockDb => ({
  ...db,
  workspaces: db.workspaces.map((workspace) => (workspace.id === workspaceId ? patch(workspace) : workspace)),
});

const setRole = (db: MockDb, workspaceId: string, accountId: string, role: WorkspaceRole) =>
  replaceWorkspace(db, workspaceId, (workspace) => ({ ...workspace, members: workspace.members.map((member) => (member.accountId === accountId ? { ...member, role } : member)) }));

/**
 * 현재 초대 링크. 재발급하면 이전 링크는 active가 꺼진다.
 * 유효한 링크가 여럿이면 가장 최근 것을, 모두 만료됐으면 가장 최근의 만료 링크를 보여 재발급을 안내한다.
 */
export const currentInvite = (db: MockDb, workspaceId: string, at = Date.now()) => {
  const active = db.invites.filter((invite) => invite.workspaceId === workspaceId && invite.active).reverse();
  return active.find((invite) => !invite.expiresAt || new Date(invite.expiresAt).getTime() > at) ?? active[0];
};

/* ── 일반·초대·보안 ── */

export const renameWorkspace = (db: MockDb, workspaceId: string, accountId: string, name: string): MockDb => {
  requireManager(db, workspaceId, accountId);
  const error = validateWorkspaceName(name);
  if (error) throw new DataError(error, 'INVALID');
  return replaceWorkspace(db, workspaceId, (workspace) => ({ ...workspace, name: name.trim() }));
};

/** 재발급(13 §4.2, US-13-02). 이전 링크는 바로 무효가 된다. days가 null이면 만료 없음. */
export const refreshInvite = (db: MockDb, workspaceId: string, accountId: string, days: number | null, at = Date.now(), generate = randomCode): MockDb => {
  requireManager(db, workspaceId, accountId);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) throw new DataError('만료 기간을 다시 골라 주세요.', 'INVALID');
  return {
    ...db,
    invites: [
      ...db.invites.map((invite) => (invite.workspaceId === workspaceId ? { ...invite, active: false } : invite)),
      { workspaceId, code: generate(), expiresAt: days === null ? null : new Date(at + days * 86_400_000).toISOString(), active: true, usedCount: 0 },
    ],
  };
};

/** 합류 비밀번호(10-D4). 빈 값이나 null이면 비밀번호를 없앤다. */
export const setWorkspacePassword = async (db: MockDb, workspaceId: string, accountId: string, password: string | null): Promise<MockDb> => {
  requireOwner(db, workspaceId, accountId);
  if (!password) return replaceWorkspace(db, workspaceId, (workspace) => ({ ...workspace, passwordHash: undefined }));
  const error = validateWorkspacePassword(password);
  if (error) throw new DataError(error, 'INVALID');
  const passwordHash = await hashPassword(password);
  return replaceWorkspace(db, workspaceId, (workspace) => ({ ...workspace, passwordHash }));
};

/* ── 역할(§5.2, §5.3) ── */

const requireAction = (db: MockDb, workspaceId: string, actorId: string, targetId: string, action: keyof ReturnType<typeof memberActions>) => {
  const workspace = workspaceOf(db, workspaceId);
  const actorRole = roleOf(workspace, actorId);
  const target = workspace.members.find((member) => member.accountId === targetId);
  if (!target) throw new DataError('멤버를 찾을 수 없어요.', 'NOT_FOUND');
  if (!memberActions(actorRole, actorId, target)[action]) throw new DataError('이 멤버에게는 할 수 없는 일이에요.', 'FORBIDDEN');
  return target;
};

export const changeRole = (db: MockDb, workspaceId: string, actorId: string, targetId: string, role: 'ADMIN' | 'MEMBER'): MockDb => {
  requireAction(db, workspaceId, actorId, targetId, role === 'ADMIN' ? 'promote' : 'demote');
  return setRole(db, workspaceId, targetId, role);
};

/** 개설자 넘기기. 받는 사람 이름을 그대로 입력해야 한다. 넘긴 사람은 매니저가 된다. */
export const transferOwnership = (db: MockDb, workspaceId: string, actorId: string, targetId: string, confirmName: string): MockDb => {
  requireAction(db, workspaceId, actorId, targetId, 'transfer');
  const name = db.accounts.find((account) => account.id === targetId)?.name;
  if (confirmName.trim() !== name) throw new DataError('받는 사람 이름이 맞지 않아요.', 'INVALID');
  return setRole(setRole(db, workspaceId, targetId, 'OWNER'), workspaceId, actorId, 'ADMIN');
};

/* ── 내보내기·차단·나가기(§5.1) ── */

type RemoveReason = 'KICK' | 'BAN' | 'LEAVE';

/**
 * 워크스페이스에서 한 사람을 뺀다. 팀, 그룹 채팅방, 회의 참여, 대기 중인 지원·스카우트를 함께 정리한다.
 * 팀장이면 스스로 나갈 때는 위임부터 하게 하고, 내보내거나 차단할 때는 가장 먼저 합류한 팀원에게 팀장을 넘긴다.
 * 혼자 남은 팀장이면 팀을 해체한다. 돌려주는 successor는 새 팀장이다(알림용).
 */
const removeFromWorkspace = (db: MockDb, workspaceId: string, targetId: string, reason: RemoveReason): { db: MockDb; successor?: { teamId: string; accountId: string } } => {
  const workspace = workspaceOf(db, workspaceId);
  const member = workspace.members.find((item) => item.accountId === targetId)!;
  let next = db;
  let successor: { teamId: string; accountId: string } | undefined;
  const team = member.teamId ? db.teams.find((item) => item.id === member.teamId) : undefined;
  if (team) {
    if (team.leaderId === targetId && team.memberIds.length > 1) {
      if (reason === 'LEAVE') throw new DataError(`${team.name} 팀장이에요. 팀장을 위임한 뒤에 나갈 수 있어요.`, 'CONFLICT');
      const heir = team.memberIds.find((id) => id !== targetId)!;
      successor = { teamId: team.id, accountId: heir };
      next = { ...next, teams: next.teams.map((item) => (item.id === team.id ? { ...item, leaderId: heir, delegation: undefined } : item)) };
      next = detach(next, workspaceId, team.id, targetId);
    } else if (team.leaderId === targetId) {
      next = disband(next, workspaceId, team.id);
    } else {
      next = detach(next, workspaceId, team.id, targetId);
    }
  }
  const session = findSession(next, workspaceId);
  const label = reason === 'LEAVE' ? '워크스페이스를 나감' : '워크스페이스에서 제외됨';
  next = {
    ...next,
    workspaces: next.workspaces.map((item) => (item.id === workspaceId ? { ...item, members: item.members.filter((entry) => entry.accountId !== targetId) } : item)),
    chatRooms: next.chatRooms.map((room) => (room.workspaceId === workspaceId && room.kind === 'GROUP' && room.memberIds.includes(targetId) ? { ...room, memberIds: room.memberIds.filter((id) => id !== targetId) } : room)),
    videoPresence: next.videoPresence.filter((item) => !(item.accountId === targetId && next.videoChannels.some((channel) => channel.id === item.channelId && channel.workspaceId === workspaceId))),
    applications: next.applications.map((app) =>
      session && app.sessionId === session.id && app.applicantId === targetId && app.status === 'PENDING' ? { ...app, status: 'EXPIRED', reason: label, decidedAt: now() } : app,
    ),
  };
  if (reason === 'BAN') next = { ...next, bans: [...next.bans, { workspaceId, accountId: targetId, bannedAt: now() }] };
  return { db: next, successor };
};

export const kickMember = (db: MockDb, workspaceId: string, actorId: string, targetId: string) => {
  requireAction(db, workspaceId, actorId, targetId, 'kick');
  return removeFromWorkspace(db, workspaceId, targetId, 'KICK');
};

/** 차단. 내보내기에 더해 다시 합류하지 못하게 기록한다. 초대 링크로 합류할 때 확인한다(authRules.joinByInvite). */
export const banMember = (db: MockDb, workspaceId: string, actorId: string, targetId: string) => {
  requireAction(db, workspaceId, actorId, targetId, 'ban');
  return removeFromWorkspace(db, workspaceId, targetId, 'BAN');
};

export const unbanMember = (db: MockDb, workspaceId: string, actorId: string, targetId: string): MockDb => {
  requireManager(db, workspaceId, actorId);
  if (!db.bans.some((ban) => ban.workspaceId === workspaceId && ban.accountId === targetId)) throw new DataError('차단 목록에 없어요.', 'NOT_FOUND');
  return { ...db, bans: db.bans.filter((ban) => !(ban.workspaceId === workspaceId && ban.accountId === targetId)) };
};

/** 나가기. 개설자는 다른 사람에게 넘긴 뒤에 나가고, 혼자 남았으면 삭제해야 한다(§5.3 OWNER 탈퇴). */
export const leaveWorkspace = (db: MockDb, workspaceId: string, accountId: string): MockDb => {
  const workspace = workspaceOf(db, workspaceId);
  if (roleOf(workspace, accountId) === 'OWNER') {
    if (workspace.members.length === 1) throw new DataError('혼자 남은 개설자는 나갈 수 없어요. 워크스페이스를 삭제해 주세요.', 'CONFLICT');
    throw new DataError('개설자는 다른 멤버에게 넘긴 뒤에 나갈 수 있어요.', 'CONFLICT');
  }
  return removeFromWorkspace(db, workspaceId, accountId, 'LEAVE').db;
};

/** 삭제. 워크스페이스 이름을 그대로 입력해야 한다. 팀과 그 안의 기록, 채팅, 초대 링크, 알림을 함께 지운다. */
export const deleteWorkspace = (db: MockDb, workspaceId: string, accountId: string, confirmName: string): MockDb => {
  const workspace = requireOwner(db, workspaceId, accountId);
  if (confirmName.trim() !== workspace.name) throw new DataError('워크스페이스 이름이 맞지 않아요.', 'INVALID');
  const next = db.teams.filter((team) => team.workspaceId === workspaceId).reduce((acc, team) => disband(acc, workspaceId, team.id), db);
  const roomIds = new Set(next.chatRooms.filter((room) => room.workspaceId === workspaceId).map((room) => room.id));
  const channelIds = new Set(next.videoChannels.filter((channel) => channel.workspaceId === workspaceId).map((channel) => channel.id));
  const sessionIds = new Set(next.sessions.filter((session) => session.workspaceId === workspaceId).map((session) => session.id));
  return {
    ...next,
    workspaces: next.workspaces.filter((item) => item.id !== workspaceId),
    sessions: next.sessions.filter((session) => !sessionIds.has(session.id)),
    applications: next.applications.filter((app) => !sessionIds.has(app.sessionId)),
    announcements: next.announcements.filter((item) => item.workspaceId !== workspaceId),
    chatRooms: next.chatRooms.filter((room) => !roomIds.has(room.id)),
    chatMessages: next.chatMessages.filter((message) => !roomIds.has(message.roomId)),
    videoChannels: next.videoChannels.filter((channel) => !channelIds.has(channel.id)),
    videoPresence: next.videoPresence.filter((item) => !channelIds.has(item.channelId)),
    notifications: next.notifications.filter((item) => item.workspaceId !== workspaceId),
    invites: next.invites.filter((invite) => invite.workspaceId !== workspaceId),
    bans: next.bans.filter((ban) => ban.workspaceId !== workspaceId),
    reminders: next.reminders.filter((item) => item.workspaceId !== workspaceId),
  };
};

/**
 * 보관(01-D4, US-13-07)과 해제. 개설자만 한다. 보관하면 읽기 전용이 되고, 쓰기는 archiveGuard가 막는다.
 * 진행 중인(OPEN·CLOSING) 팀 빌딩 세션은 끝내고 대기 중인 지원·스카우트를 만료한다(13-D7). 해제해도 세션은 되살리지 않는다.
 */
export const setArchived = (db: MockDb, workspaceId: string, accountId: string, archived: boolean): MockDb => {
  const workspace = requireOwner(db, workspaceId, accountId);
  if (Boolean(workspace.archivedAt) === archived) return db;
  if (!archived) return replaceWorkspace(db, workspaceId, (item) => ({ ...item, archivedAt: undefined }));
  const session = findSession(db, workspaceId);
  const closing = session && (session.status === 'OPEN' || session.status === 'CLOSING');
  return {
    ...replaceWorkspace(db, workspaceId, (item) => ({ ...item, archivedAt: now() })),
    sessions: closing ? db.sessions.map((item) => (item.id === session.id ? { ...item, status: 'RESOLVED' as const } : item)) : db.sessions,
    applications: closing
      ? db.applications.map((app) => (app.sessionId === session.id && app.status === 'PENDING' ? { ...app, status: 'EXPIRED' as const, reason: '워크스페이스 보관', decidedAt: now() } : app))
      : db.applications,
  };
};

/**
 * 시스템 관리자의 워크스페이스 차단(17 §5.1 BANNED_WS). 워크스페이스 역할 검사 없이 차단 파급(§5.1)을 그대로 적용한다.
 * 개설자는 워크스페이스에서 뺄 수 없으므로 막는다. 그 경우는 계정 정지로 다룬다.
 */
export const banBySystem = (db: MockDb, workspaceId: string, targetId: string) => {
  const workspace = workspaceOf(db, workspaceId);
  const member = workspace.members.find((item) => item.accountId === targetId);
  if (!member) return { db, successor: undefined };
  if (member.role === 'OWNER') throw new DataError('개설자는 워크스페이스에서 차단할 수 없어요. 계정 정지로 처리해 주세요.', 'CONFLICT');
  return removeFromWorkspace(db, workspaceId, targetId, 'BAN');
};

