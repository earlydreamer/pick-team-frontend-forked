import { activeDelegation, validateTeamInfo, type TeamInfoInput } from '@/renewal/domain/teamSpace';
import { DataError } from '../ports';
import type { MockDb } from './db';
import { teamAccess } from './kanbanRules';
import { findSession } from './rules';

/*
 * 팀 설정 규칙(14 §2, §4.6, §5.4, §5.5).
 *
 * | 행동 | 할 수 있는 사람 |
 * |---|---|
 * | 이름·소개 수정, 팀장 위임 지명·취소 | 팀장 |
 * | 위임 수락·거절 | 지명된 팀원 |
 * | 팀원 내보내기, 팀 삭제 | 팀장, 워크스페이스 개설자·매니저 |
 * | 팀 나가기 | 팀원. 팀장은 위임을 마친 뒤 나갈 수 있고, 혼자 남은 팀장이 나가면 팀을 해체한다 |
 */

const now = () => new Date().toISOString();
const teamOf = (db: MockDb, teamId: string) => db.teams.find((item) => item.id === teamId)!;

const requireLeader = (db: MockDb, workspaceId: string, teamId: string, accountId: string) => {
  if (!teamAccess(db, workspaceId, teamId, accountId).isLeader) throw new DataError('팀장만 할 수 있어요.', 'FORBIDDEN');
};

const requireLeaderOrManager = (db: MockDb, workspaceId: string, teamId: string, accountId: string) => {
  const access = teamAccess(db, workspaceId, teamId, accountId);
  if (!access.isLeader && !access.isManagerViewer) throw new DataError('팀장과 워크스페이스 관리자만 할 수 있어요.', 'FORBIDDEN');
};

const replaceTeam = (db: MockDb, teamId: string, patch: Partial<MockDb['teams'][number]>): MockDb => ({
  ...db,
  teams: db.teams.map((team) => (team.id === teamId ? { ...team, ...patch } : team)),
});

/** 팀에서 한 명을 뺀다. 팀원 목록, 멤버의 소속, 담당 태스크를 함께 정리한다. */
const detach = (db: MockDb, workspaceId: string, teamId: string, accountId: string): MockDb => {
  const team = teamOf(db, teamId);
  return {
    ...db,
    teams: db.teams.map((item) => (item.id === teamId ? { ...item, memberIds: item.memberIds.filter((id) => id !== accountId), delegation: item.delegation?.targetId === accountId ? undefined : item.delegation } : item)),
    workspaces: db.workspaces.map((workspace) =>
      workspace.id !== workspaceId ? workspace : { ...workspace, members: workspace.members.map((member) => (member.accountId === accountId && member.teamId === team.id ? { ...member, teamId: undefined } : member)) },
    ),
    tasks: db.tasks.map((task) => (task.teamId === teamId && task.assigneeIds.includes(accountId) ? { ...task, assigneeIds: task.assigneeIds.filter((id) => id !== accountId) } : task)),
  };
};

export const updateTeamInfo = (db: MockDb, workspaceId: string, teamId: string, accountId: string, input: TeamInfoInput): MockDb => {
  requireLeader(db, workspaceId, teamId, accountId);
  const first = Object.values(validateTeamInfo(input)).find(Boolean);
  if (first) throw new DataError(first, 'INVALID');
  const name = input.name.trim();
  if (db.teams.some((team) => team.workspaceId === workspaceId && team.id !== teamId && team.name === name)) throw new DataError('같은 이름의 팀이 이미 있어요.', 'CONFLICT');
  return replaceTeam(db, teamId, { name, intro: input.intro?.trim() || undefined });
};

/* ── 팀장 위임(14 §5.4) ── */

export const requestDelegation = (db: MockDb, workspaceId: string, teamId: string, accountId: string, targetId: string): MockDb => {
  requireLeader(db, workspaceId, teamId, accountId);
  const team = teamOf(db, teamId);
  if (targetId === accountId || !team.memberIds.includes(targetId)) throw new DataError('위임할 팀원을 다시 골라 주세요.', 'INVALID');
  if (activeDelegation(team)) throw new DataError('이미 위임 요청이 진행 중이에요. 취소한 뒤 다시 지명해 주세요.', 'CONFLICT');
  return replaceTeam(db, teamId, { delegation: { targetId, requestedAt: now() } });
};

export const cancelDelegation = (db: MockDb, workspaceId: string, teamId: string, accountId: string): MockDb => {
  requireLeader(db, workspaceId, teamId, accountId);
  return replaceTeam(db, teamId, { delegation: undefined });
};

/** 지명된 팀원의 응답. 수락하면 팀장이 바뀌고 이전 팀장은 팀원이 된다. */
export const respondDelegation = (db: MockDb, workspaceId: string, teamId: string, accountId: string, accept: boolean): MockDb => {
  teamAccess(db, workspaceId, teamId, accountId);
  const team = teamOf(db, teamId);
  if (team.delegation?.targetId !== accountId) throw new DataError('나에게 온 위임 요청이 없어요.', 'NOT_FOUND');
  if (!activeDelegation(team)) throw new DataError('위임 요청이 만료됐어요. 팀장에게 다시 요청해 달라고 알려 주세요.', 'GONE');
  return replaceTeam(db, teamId, accept ? { leaderId: accountId, delegation: undefined } : { delegation: undefined });
};

/* ── 멤버 관리·나가기·삭제 ── */

export const removeMember = (db: MockDb, workspaceId: string, teamId: string, accountId: string, targetId: string): MockDb => {
  requireLeaderOrManager(db, workspaceId, teamId, accountId);
  const team = teamOf(db, teamId);
  if (!team.memberIds.includes(targetId)) throw new DataError('팀원이 아니에요.', 'NOT_FOUND');
  if (targetId === team.leaderId) throw new DataError('팀장은 내보낼 수 없어요. 위임한 뒤 내보내 주세요.', 'CONFLICT');
  return detach(db, workspaceId, teamId, targetId);
};

/**
 * 팀 삭제. 팀 이름을 그대로 입력해야 한다(14 §5.5 prompt() 대체).
 * 팀 빌딩 모집 중이면 이 팀에 걸린 대기 제안을 만료한다(12 §5.4-4).
 */
export const deleteTeam = (db: MockDb, workspaceId: string, teamId: string, accountId: string, confirmName: string): MockDb => {
  requireLeaderOrManager(db, workspaceId, teamId, accountId);
  const team = teamOf(db, teamId);
  if (confirmName.trim() !== team.name) throw new DataError('팀 이름이 맞지 않아요.', 'INVALID');
  return disband(db, workspaceId, teamId);
};

const disband = (db: MockDb, workspaceId: string, teamId: string): MockDb => {
  const team = teamOf(db, teamId);
  const session = findSession(db, workspaceId);
  return {
    ...db,
    teams: db.teams.filter((item) => item.id !== teamId),
    workspaces: db.workspaces.map((workspace) =>
      workspace.id !== workspaceId ? workspace : { ...workspace, members: workspace.members.map((member) => (member.teamId === team.id ? { ...member, teamId: undefined } : member)) },
    ),
    tasks: db.tasks.filter((task) => task.teamId !== teamId),
    schedules: db.schedules.filter((item) => item.teamId !== teamId),
    posts: db.posts.filter((item) => item.teamId !== teamId),
    announcements: db.announcements.filter((item) => item.teamId !== teamId),
    rolesConfirmedTeamIds: db.rolesConfirmedTeamIds.filter((id) => id !== teamId),
    applications: db.applications.map((app) =>
      session && app.sessionId === session.id && app.teamId === teamId && app.status === 'PENDING' ? { ...app, status: 'EXPIRED', reason: '팀 해체', decidedAt: now() } : app,
    ),
  };
};

/**
 * 팀 나가기. 팀장은 다른 팀원이 있으면 위임부터 해야 하고, 위임을 기다리는 중이면 그렇게 알린다(14 §5.4).
 * 혼자 남은 팀장이 나가면 팀을 해체한다.
 */
export const leaveTeam = (db: MockDb, workspaceId: string, teamId: string, accountId: string): { db: MockDb; disbanded: boolean } => {
  const access = teamAccess(db, workspaceId, teamId, accountId);
  if (!access.isMember) throw new DataError('팀원이 아니에요.', 'FORBIDDEN');
  const team = teamOf(db, teamId);
  if (access.isLeader) {
    if (team.memberIds.length === 1) return { db: disband(db, workspaceId, teamId), disbanded: true };
    if (activeDelegation(team)) throw new DataError('위임 수락을 기다리는 중이에요. 수락한 뒤에 나갈 수 있어요.', 'CONFLICT');
    throw new DataError('팀장은 다른 팀원에게 위임한 뒤에 나갈 수 있어요.', 'CONFLICT');
  }
  return { db: detach(db, workspaceId, teamId, accountId), disbanded: false };
};
