import { isRequiredComplete, type GoalTemperature } from '@/renewal/domain/card';
import { TEAM_BUILDING_RULES, openSeats, type RecruitRole, type TeamApplication } from '@/renewal/domain/teamBuilding';
import { DataError } from '../ports';
import type { MockDb } from './db';

/*
 * 팀 빌딩 상태 규칙(12 §2, §5.2, §6.1.1)을 목 저장소 위에서 구현한다.
 * 백엔드가 같은 규칙을 서버 트랜잭션으로 구현할 때 기준이 되도록 순수 함수로 두고 테스트한다.
 */

const now = () => new Date().toISOString();
let sequence = 0;
const newId = () => `app-${Date.now().toString(36)}-${(sequence++).toString(36)}`;

export const findSession = (db: MockDb, workspaceId: string) => db.sessions.find((session) => session.workspaceId === workspaceId) ?? null;

const membership = (db: MockDb, workspaceId: string, accountId: string) =>
  db.workspaces.find((workspace) => workspace.id === workspaceId)?.members.find((member) => member.accountId === accountId);

const requireOpenSession = (db: MockDb, workspaceId: string) => {
  const session = findSession(db, workspaceId);
  if (!session) throw new DataError('진행 중인 팀 빌딩이 없어요.', 'NOT_FOUND');
  if (session.status !== 'OPEN') throw new DataError('팀 빌딩 모집 기간이 아니라서 제안을 보내거나 받을 수 없어요.', 'CONFLICT');
  return session;
};

const teamOf = (db: MockDb, workspaceId: string, accountId: string) =>
  db.teams.find((team) => team.workspaceId === workspaceId && team.memberIds.includes(accountId));

/** 매니저·개설자는 지원과 스카우트의 당사자가 될 수 없다(12 §2). */
const requireParticipant = (db: MockDb, workspaceId: string, accountId: string) => {
  const member = membership(db, workspaceId, accountId);
  if (!member) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  if (member.role !== 'MEMBER') throw new DataError('개설자와 매니저는 지원이나 스카우트를 할 수 없어요.', 'FORBIDDEN');
  return member;
};

const requirePublicCard = (db: MockDb, accountId: string, message: string) => {
  const card = db.cards[accountId];
  if (!card?.consentGivenAt || !isRequiredComplete(card) || !card.cardVisible) throw new DataError(message, 'CARD_REQUIRED');
};

const hasPending = (db: MockDb, sessionId: string, direction: TeamApplication['direction'], applicantId: string, teamId: string) =>
  db.applications.some(
    (app) => app.sessionId === sessionId && app.direction === direction && app.applicantId === applicantId && app.teamId === teamId && app.status === 'PENDING',
  );

export const apply = (db: MockDb, workspaceId: string, applicantId: string, teamId: string, message?: string): MockDb => {
  const session = requireOpenSession(db, workspaceId);
  requireParticipant(db, workspaceId, applicantId);
  requirePublicCard(db, applicantId, '지원하려면 먼저 PR 카드를 만들어 공개해 주세요.');
  if (teamOf(db, workspaceId, applicantId)) throw new DataError('이미 팀에 소속되어 있어 지원할 수 없어요.', 'CONFLICT');
  const team = db.teams.find((item) => item.id === teamId && item.workspaceId === workspaceId);
  if (!team) throw new DataError('모집 중인 팀을 찾을 수 없어요.', 'NOT_FOUND');
  if (openSeats(team, session.teamCapacity) === 0) throw new DataError('이 팀은 정원이 찼어요.', 'CONFLICT');
  if (hasPending(db, session.id, 'APPLY', applicantId, teamId)) throw new DataError('이미 이 팀에 지원했어요. 답변을 기다려 주세요.', 'CONFLICT');
  const pending = db.applications.filter((app) => app.sessionId === session.id && app.direction === 'APPLY' && app.applicantId === applicantId && app.status === 'PENDING');
  if (pending.length >= TEAM_BUILDING_RULES.maxPendingApplies) {
    throw new DataError(`답변을 기다리는 지원이 ${TEAM_BUILDING_RULES.maxPendingApplies}건이에요. 하나를 철회하거나 답변을 받은 뒤 다시 지원해 주세요.`, 'CONFLICT');
  }
  const app: TeamApplication = { id: newId(), sessionId: session.id, direction: 'APPLY', applicantId, teamId, message: message?.trim() || undefined, status: 'PENDING', createdAt: now() };
  return { ...db, applications: [...db.applications, app] };
};

/** 스카우트는 팀장만 보낼 수 있다(12-D1). */
export const scout = (db: MockDb, workspaceId: string, leaderId: string, targetId: string, message?: string): MockDb => {
  const session = requireOpenSession(db, workspaceId);
  const team = teamOf(db, workspaceId, leaderId);
  if (!team || team.leaderId !== leaderId) throw new DataError('스카우트는 팀장만 보낼 수 있어요.', 'FORBIDDEN');
  if (openSeats(team, session.teamCapacity) === 0) throw new DataError('팀 정원이 이미 찼어요.', 'CONFLICT');
  requireParticipant(db, workspaceId, targetId);
  requirePublicCard(db, targetId, '카드를 공개한 멤버에게만 스카우트를 보낼 수 있어요.');
  if (teamOf(db, workspaceId, targetId)) throw new DataError('이미 다른 팀에 소속된 멤버예요.', 'CONFLICT');
  if (hasPending(db, session.id, 'SCOUT', targetId, team.id)) throw new DataError('이미 이 멤버에게 스카우트를 보냈어요.', 'CONFLICT');
  const app: TeamApplication = { id: newId(), sessionId: session.id, direction: 'SCOUT', applicantId: targetId, teamId: team.id, message: message?.trim() || undefined, status: 'PENDING', createdAt: now() };
  return { ...db, applications: [...db.applications, app] };
};

/** 받은 쪽인지 확인한다. 지원은 팀장이, 스카우트는 대상 멤버가 받는다. */
const isRecipient = (db: MockDb, app: TeamApplication, accountId: string) => {
  if (app.direction === 'SCOUT') return app.applicantId === accountId;
  return db.teams.find((team) => team.id === app.teamId)?.leaderId === accountId;
};

const close = (app: TeamApplication, status: TeamApplication['status'], reason?: string): TeamApplication => ({ ...app, status, reason, decidedAt: now() });

/**
 * 수락하면 합류를 확정하고 연쇄 정리를 한다(12 §5.2).
 * 합류자의 다른 대기 제안은 자동 철회하고, 팀이 정원을 채우면 팀에 남은 대기 제안은 정원 마감으로 정리한다.
 */
export const accept = (db: MockDb, workspaceId: string, accountId: string, applicationId: string): MockDb => {
  const session = requireOpenSession(db, workspaceId);
  const app = db.applications.find((item) => item.id === applicationId && item.sessionId === session.id);
  if (!app) throw new DataError('제안을 찾을 수 없어요.', 'NOT_FOUND');
  if (!isRecipient(db, app, accountId)) throw new DataError('내가 받은 제안만 수락할 수 있어요.', 'FORBIDDEN');
  if (app.status !== 'PENDING') throw new DataError('이미 처리된 제안이에요.', 'CONFLICT');
  const team = db.teams.find((item) => item.id === app.teamId)!;
  if (openSeats(team, session.teamCapacity) === 0) throw new DataError('방금 정원이 찼어요.', 'CONFLICT');
  if (teamOf(db, workspaceId, app.applicantId)) throw new DataError('이미 다른 팀에 합류한 멤버예요.', 'CONFLICT');

  const joinedTeam = { ...team, memberIds: [...team.memberIds, app.applicantId] };
  const full = openSeats(joinedTeam, session.teamCapacity) === 0;
  const applications = db.applications.map((item) => {
    if (item.id === app.id) return close(item, 'ACCEPTED');
    if (item.status !== 'PENDING' || item.sessionId !== session.id) return item;
    if (item.applicantId === app.applicantId) return close(item, 'AUTO_WITHDRAWN', `${team.name} 합류로 자동 철회`);
    if (full && item.teamId === team.id) return close(item, item.direction === 'APPLY' ? 'DECLINED' : 'WITHDRAWN', '정원 마감');
    return item;
  });
  const workspaces = db.workspaces.map((workspace) =>
    workspace.id !== workspaceId
      ? workspace
      : { ...workspace, members: workspace.members.map((member) => (member.accountId === app.applicantId ? { ...member, teamId: team.id } : member)) },
  );
  return { ...db, applications, workspaces, teams: db.teams.map((item) => (item.id === team.id ? joinedTeam : item)) };
};

export const decline = (db: MockDb, workspaceId: string, accountId: string, applicationId: string): MockDb => {
  const app = db.applications.find((item) => item.id === applicationId);
  if (!app || !findSession(db, workspaceId) || app.sessionId !== findSession(db, workspaceId)!.id) throw new DataError('제안을 찾을 수 없어요.', 'NOT_FOUND');
  if (!isRecipient(db, app, accountId)) throw new DataError('내가 받은 제안만 거절할 수 있어요.', 'FORBIDDEN');
  if (app.status !== 'PENDING') throw new DataError('이미 처리된 제안이에요.', 'CONFLICT');
  return { ...db, applications: db.applications.map((item) => (item.id === app.id ? close(item, 'DECLINED') : item)) };
};

/** 보낸 쪽만 철회할 수 있다. 지원은 지원자가, 스카우트는 팀장이 보낸 쪽이다. */
export const withdraw = (db: MockDb, workspaceId: string, accountId: string, applicationId: string): MockDb => {
  const app = db.applications.find((item) => item.id === applicationId);
  if (!app || !findSession(db, workspaceId) || app.sessionId !== findSession(db, workspaceId)!.id) throw new DataError('제안을 찾을 수 없어요.', 'NOT_FOUND');
  const sender = app.direction === 'APPLY' ? app.applicantId : db.teams.find((team) => team.id === app.teamId)?.leaderId;
  if (sender !== accountId) throw new DataError('내가 보낸 제안만 철회할 수 있어요.', 'FORBIDDEN');
  if (app.status !== 'PENDING') throw new DataError('이미 처리된 제안이에요.', 'CONFLICT');
  return { ...db, applications: db.applications.map((item) => (item.id === app.id ? close(item, 'WITHDRAWN') : item)) };
};

/** 팀 개설(모집 공고). 개설자가 잠정 팀장이 된다. 01-D2 결정에 따라 멤버 누구나 개설할 수 있다. */
export const createTeam = (
  db: MockDb,
  workspaceId: string,
  accountId: string,
  input: { name: string; intro?: string; goalTemperature?: GoalTemperature; recruitRoles: RecruitRole[] },
): { db: MockDb; teamId: string } => {
  requireOpenSession(db, workspaceId);
  requireParticipant(db, workspaceId, accountId);
  requirePublicCard(db, accountId, '팀을 만들려면 먼저 PR 카드를 만들어 공개해 주세요.');
  if (teamOf(db, workspaceId, accountId)) throw new DataError('이미 팀에 소속되어 있어 새 팀을 만들 수 없어요.', 'CONFLICT');
  const name = input.name.trim();
  if (!name) throw new DataError('팀 이름을 입력해 주세요.', 'INVALID');
  if (db.teams.some((team) => team.workspaceId === workspaceId && team.name === name)) throw new DataError('같은 이름의 팀이 이미 있어요.', 'CONFLICT');
  const teamId = `t-${Date.now().toString(36)}`;
  // 팀을 만들면 내가 보낸 대기 지원은 자동 철회한다(한 세션에서 한 팀에만 소속).
  const session = findSession(db, workspaceId)!;
  const applications = db.applications.map((app) =>
    app.sessionId === session.id && app.applicantId === accountId && app.status === 'PENDING' ? close(app, 'AUTO_WITHDRAWN', `${name} 개설로 자동 철회`) : app,
  );
  const workspaces = db.workspaces.map((workspace) =>
    workspace.id !== workspaceId ? workspace : { ...workspace, members: workspace.members.map((member) => (member.accountId === accountId ? { ...member, teamId } : member)) },
  );
  const team = { id: teamId, workspaceId, name, leaderId: accountId, memberIds: [accountId], intro: input.intro?.trim() || undefined, goalTemperature: input.goalTemperature, recruitRoles: input.recruitRoles };
  return { db: { ...db, teams: [...db.teams, team], applications, workspaces }, teamId };
};
