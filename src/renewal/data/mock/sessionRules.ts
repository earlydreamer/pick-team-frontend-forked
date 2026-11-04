import { emptyCard } from '@/renewal/domain/card';
import { isManager } from '@/renewal/domain/workspace';
import { openSeats, validateSessionSettings, type SessionSettingsInput, type Team } from '@/renewal/domain/teamBuilding';
import { DataError } from '../ports';
import type { MockDb } from './db';
import { findSession } from './rules';

/*
 * 세션 운영 규칙(12 §4.4, §5.1). 매니저만 바꿀 수 있고, 상태마다 허용하는 조작이 다르다.
 *
 * | 상태 | 허용하는 조작 |
 * |---|---|
 * | 없음 | 세션 만들기 |
 * | DRAFT | 설정 변경, 모집 시작 |
 * | OPEN | 마감 연장, 지금 마감 |
 * | CLOSING | 수동 배치, 배치 취소, 새 팀 슬롯, 랜덤 배치, 결과 확정 |
 * | RESOLVED | 없음(12-D5 재오픈 불가) |
 */

const now = () => new Date().toISOString();

const workspaceOf = (db: MockDb, workspaceId: string) => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  return workspace;
};

export const requireManager = (db: MockDb, workspaceId: string, accountId: string) => {
  const member = workspaceOf(db, workspaceId).members.find((item) => item.accountId === accountId);
  if (!member) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  if (!isManager(member.role)) throw new DataError('개설자와 매니저만 할 수 있어요.', 'FORBIDDEN');
};

const requireSession = (db: MockDb, workspaceId: string, status: string, message: string) => {
  const session = findSession(db, workspaceId);
  if (!session) throw new DataError('팀 빌딩 세션이 없어요.', 'NOT_FOUND');
  if (session.status !== status) throw new DataError(message, 'CONFLICT');
  return session;
};

const invalid = (errors: Record<string, string | undefined>) => {
  const first = Object.values(errors).find(Boolean);
  if (first) throw new DataError(first, 'INVALID');
};

/** 팀 빌딩 참여 대상: MEMBER 역할만(12 §2) */
export const participantsOf = (db: MockDb, workspaceId: string) => workspaceOf(db, workspaceId).members.filter((member) => member.role === 'MEMBER');

const teamsOf = (db: MockDb, workspaceId: string) => db.teams.filter((team) => team.workspaceId === workspaceId);

const replaceSession = (db: MockDb, workspaceId: string, change: Partial<MockDb['sessions'][number]>): MockDb => ({
  ...db,
  sessions: db.sessions.map((session) => (session.workspaceId === workspaceId ? { ...session, ...change } : session)),
});

/** 팀과 멤버 소속을 함께 바꾼다. 팀원 목록과 멤버의 teamId가 어긋나지 않게 한곳에서만 쓴다. */
const setMembership = (db: MockDb, workspaceId: string, accountId: string, teamId: string | undefined, teams: Team[]): MockDb => ({
  ...db,
  teams: db.teams.map((team) => teams.find((item) => item.id === team.id) ?? team),
  workspaces: db.workspaces.map((workspace) =>
    workspace.id !== workspaceId
      ? workspace
      : { ...workspace, members: workspace.members.map((member) => (member.accountId === accountId ? { ...member, teamId } : member)) },
  ),
});

export const createSession = (db: MockDb, workspaceId: string, actorId: string, input: SessionSettingsInput): MockDb => {
  requireManager(db, workspaceId, actorId);
  if (findSession(db, workspaceId)) throw new DataError('이 워크스페이스에는 이미 팀 빌딩 세션이 있어요.', 'CONFLICT');
  invalid(validateSessionSettings(input));
  return {
    ...db,
    sessions: [...db.sessions, { id: `s-${Date.now().toString(36)}`, workspaceId, status: 'DRAFT', closesAt: input.closesAt, teamCapacity: input.teamCapacity }],
  };
};

/** DRAFT에서는 마감과 정원을 바꾸고, OPEN에서는 마감 연장만 허용한다. 모집 중 정원을 바꾸면 이미 꾸린 팀이 정원을 넘을 수 있다. */
export const updateSession = (db: MockDb, workspaceId: string, actorId: string, input: SessionSettingsInput): MockDb => {
  requireManager(db, workspaceId, actorId);
  const session = findSession(db, workspaceId);
  if (!session) throw new DataError('팀 빌딩 세션이 없어요.', 'NOT_FOUND');
  if (session.status === 'DRAFT') {
    invalid(validateSessionSettings(input));
    return replaceSession(db, workspaceId, { closesAt: input.closesAt, teamCapacity: input.teamCapacity });
  }
  if (session.status === 'OPEN') {
    if (input.teamCapacity !== session.teamCapacity) throw new DataError('모집 중에는 팀 정원을 바꿀 수 없어요.', 'CONFLICT');
    invalid(validateSessionSettings(input, new Date(), session.closesAt));
    return replaceSession(db, workspaceId, { closesAt: input.closesAt });
  }
  throw new DataError('모집이 끝난 세션은 설정을 바꿀 수 없어요.', 'CONFLICT');
};

export const openSession = (db: MockDb, workspaceId: string, actorId: string): MockDb => {
  requireManager(db, workspaceId, actorId);
  const session = requireSession(db, workspaceId, 'DRAFT', '준비 중인 세션만 모집을 시작할 수 있어요.');
  if (new Date(session.closesAt).getTime() <= Date.now()) throw new DataError('모집 마감이 이미 지났어요. 마감 일시를 다시 정해 주세요.', 'INVALID');
  return replaceSession(db, workspaceId, { status: 'OPEN' });
};

/** 지금 마감: 새 제안을 막고, 답변을 기다리던 제안은 만료한다(12 §5.2 PENDING → EXPIRED). */
export const closeSession = (db: MockDb, workspaceId: string, actorId: string): MockDb => {
  requireManager(db, workspaceId, actorId);
  const session = requireSession(db, workspaceId, 'OPEN', '모집 중인 세션만 마감할 수 있어요.');
  const closed = replaceSession(db, workspaceId, { status: 'CLOSING', closesAt: now() });
  return {
    ...closed,
    applications: closed.applications.map((app) =>
      app.sessionId === session.id && app.status === 'PENDING' ? { ...app, status: 'EXPIRED', reason: '모집 마감', decidedAt: now() } : app,
    ),
  };
};

export const assignMember = (db: MockDb, workspaceId: string, actorId: string, accountId: string, teamId: string): MockDb => {
  requireManager(db, workspaceId, actorId);
  const session = requireSession(db, workspaceId, 'CLOSING', '모집을 마감한 뒤에 직접 배치할 수 있어요.');
  const member = participantsOf(db, workspaceId).find((item) => item.accountId === accountId);
  if (!member) throw new DataError('배치할 수 있는 멤버가 아니에요.', 'NOT_FOUND');
  if (member.teamId) throw new DataError('이미 팀에 배치된 멤버예요.', 'CONFLICT');
  const team = teamsOf(db, workspaceId).find((item) => item.id === teamId);
  if (!team) throw new DataError('팀을 찾을 수 없어요.', 'NOT_FOUND');
  if (openSeats(team, session.teamCapacity) === 0) throw new DataError(`${team.name}은 정원이 찼어요.`, 'CONFLICT');
  // 빈 팀 슬롯에 처음 배치한 사람이 잠정 팀장이 된다.
  const next: Team = { ...team, leaderId: team.leaderId || accountId, memberIds: [...team.memberIds, accountId] };
  return setMembership(db, workspaceId, accountId, team.id, [next]);
};

export const unassignMember = (db: MockDb, workspaceId: string, actorId: string, accountId: string): MockDb => {
  requireManager(db, workspaceId, actorId);
  requireSession(db, workspaceId, 'CLOSING', '모집을 마감한 뒤에 배치를 바꿀 수 있어요.');
  const team = teamsOf(db, workspaceId).find((item) => item.memberIds.includes(accountId));
  if (!team) throw new DataError('팀에 배치되지 않은 멤버예요.', 'CONFLICT');
  const memberIds = team.memberIds.filter((id) => id !== accountId);
  // 팀장을 빼면 남은 팀원 중 먼저 합류한 사람이 팀장을 이어받는다(12 §5.4-3과 같은 기준).
  const next: Team = { ...team, memberIds, leaderId: team.leaderId === accountId ? memberIds[0] ?? '' : team.leaderId };
  return setMembership(db, workspaceId, accountId, undefined, [next]);
};

export const addTeamSlot = (db: MockDb, workspaceId: string, actorId: string, name: string): { db: MockDb; teamId: string } => {
  requireManager(db, workspaceId, actorId);
  requireSession(db, workspaceId, 'CLOSING', '모집을 마감한 뒤에 팀 슬롯을 추가할 수 있어요.');
  const trimmed = name.trim();
  if (!trimmed) throw new DataError('팀 이름을 입력해 주세요.', 'INVALID');
  if (teamsOf(db, workspaceId).some((team) => team.name === trimmed)) throw new DataError('같은 이름의 팀이 이미 있어요.', 'CONFLICT');
  const teamId = `t-${Date.now().toString(36)}`;
  const team: Team = { id: teamId, workspaceId, name: trimmed, leaderId: '', memberIds: [], recruitRoles: [] };
  return { db: { ...db, teams: [...db.teams, team] }, teamId };
};

/**
 * 남은 미배정자 랜덤 배치(12 §5.4-6). 완전 무작위가 아니라 역할 편중을 줄이는 제약 랜덤이다.
 * 순서를 섞은 미배정자마다 빈자리가 있는 팀 중 같은 1순위 역할이 가장 적은 팀, 그다음 인원이 가장 적은 팀을 고른다.
 */
export const randomAssign = (db: MockDb, workspaceId: string, actorId: string, random: () => number = Math.random) => {
  requireManager(db, workspaceId, actorId);
  const session = requireSession(db, workspaceId, 'CLOSING', '모집을 마감한 뒤에 랜덤 배치를 할 수 있어요.');
  const queue = participantsOf(db, workspaceId)
    .filter((member) => !member.teamId)
    .map((member) => ({ member, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ member }) => member.accountId);
  let next = db;
  let assigned = 0;
  for (const accountId of queue) {
    const role = next.cards[accountId]?.desiredRole1;
    const candidates = teamsOf(next, workspaceId).filter((team) => openSeats(team, session.teamCapacity) > 0);
    if (candidates.length === 0) break;
    const sameRole = (team: Team) => team.memberIds.filter((id) => role && (next.cards[id] ?? emptyCard()).desiredRole1 === role).length;
    const best = candidates.reduce((a, b) => {
      const byRole = sameRole(a) - sameRole(b);
      if (byRole !== 0) return byRole < 0 ? a : b;
      return a.memberIds.length <= b.memberIds.length ? a : b;
    });
    next = assignMember(next, workspaceId, actorId, accountId, best.id);
    assigned += 1;
  }
  return { db: next, assigned, remaining: queue.length - assigned };
};

/** 결과 확정: 미배정이 0명일 때만 할 수 있고 되돌릴 수 없다(12-D5). 빈 팀 슬롯은 정리한다. */
export const resolveSession = (db: MockDb, workspaceId: string, actorId: string): MockDb => {
  requireManager(db, workspaceId, actorId);
  requireSession(db, workspaceId, 'CLOSING', '마감 처리 중인 세션만 확정할 수 있어요.');
  const unassigned = participantsOf(db, workspaceId).filter((member) => !member.teamId).length;
  if (unassigned > 0) throw new DataError(`아직 배치되지 않은 멤버가 ${unassigned}명 있어요.`, 'CONFLICT');
  const resolved = replaceSession(db, workspaceId, { status: 'RESOLVED' });
  return { ...resolved, teams: resolved.teams.filter((team) => team.workspaceId !== workspaceId || team.memberIds.length > 0) };
};
