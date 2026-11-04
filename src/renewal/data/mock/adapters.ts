import { cardStatus, emptyCard, isRequiredComplete, type PrCard } from '@/renewal/domain/card';
import type { Member, MemberCardState, Workspace } from '@/renewal/domain/workspace';
import { DataError, type DataSource } from '../ports';
import { aggregateTeam, matchCandidateToTeam } from '@/renewal/domain/matching';
import { openSeats, type ApplicationView, type Team, type TeamApplication, type TeamSummary } from '@/renewal/domain/teamBuilding';
import * as rules from './rules';
import * as sessionRules from './sessionRules';
import * as authRules from './authRules';
import * as kanbanRules from './kanbanRules';
import { progressOf } from '@/renewal/domain/kanban';
import { INACTIVE_DAYS, type DashboardAlert } from '@/renewal/domain/dashboard';
import { commit, getDb, latency, shouldFail, type MockDb } from './db';

const requireMe = () => {
  const db = getDb();
  const account = db.accounts.find((item) => item.id === db.currentAccountId);
  if (!account) throw new DataError('로그인이 필요해요.', 'UNAUTHORIZED');
  return account;
};

const fail = (operation: string) => {
  if (shouldFail(operation)) throw new DataError('목업 설정으로 요청을 실패시켰어요.', 'NETWORK');
};

const findWorkspaceOfMe = (workspaceId: string) => {
  const me = requireMe();
  const workspace = getDb().workspaces.find((item) => item.id === workspaceId);
  const membership = workspace?.members.find((member) => member.accountId === me.id);
  // 비소속 워크스페이스는 존재 자체를 숨긴다(02 §4, 11 §5.3).
  if (!workspace || !membership) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  return { me, workspace, membership };
};

/**
 * 다른 멤버에게 보이는 카드. 공개 카드가 아니면 내용을 비우고 상태만 남긴다.
 */
const visibleCard = (card: PrCard, isMe: boolean): PrCard => {
  if (isMe) return card;
  if (cardStatus(card) !== 'PUBLIC') return { ...emptyCard(), consentGivenAt: card.consentGivenAt, cardVisible: card.cardVisible };
  return card;
};

/** 목업 저장소 용량을 아끼려고 사진을 256px JPEG로 줄여 data URL로 저장한다. */
const toSmallDataUrl = async (file: File) => {
  if (!file.type.startsWith('image/')) throw new DataError('이미지 파일만 올릴 수 있어요.', 'INVALID');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new DataError('이미지를 읽지 못했어요. 다른 파일로 시도해 주세요.', 'INVALID');
  });
  const size = 256;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new DataError('이미지를 처리하지 못했어요.', 'UNKNOWN');
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
};

const memberCardState = (card: PrCard): MemberCardState => {
  const status = cardStatus(card);
  return status === 'PUBLIC' ? 'PUBLIC' : status === 'PRIVATE' ? 'PRIVATE' : 'NOT_WRITTEN';
};


/* ── 팀 빌딩 조회 도우미 ── */

const toMember = (db: MockDb, workspaceId: string, accountId: string, viewerId: string): Member => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId)!;
  const member = workspace.members.find((item) => item.accountId === accountId)!;
  const card = db.cards[accountId] ?? emptyCard();
  return {
    account: db.accounts.find((account) => account.id === accountId)!,
    role: member.role,
    teamId: member.teamId,
    cardState: memberCardState(card),
    card: visibleCard(card, accountId === viewerId),
  };
};

const teamCards = (db: MockDb, team: Team) => team.memberIds.map((id) => db.cards[id] ?? emptyCard());

const summarize = (db: MockDb, team: Team, viewerId: string, capacity: number): TeamSummary => {
  const session = rules.findSession(db, team.workspaceId)!;
  const myApplication = db.applications
    .filter((app) => app.sessionId === session.id && app.teamId === team.id && app.applicantId === viewerId && app.direction === 'APPLY')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const viewerCard = db.cards[viewerId];
  const viewerHasTeam = db.teams.some((item) => item.workspaceId === team.workspaceId && item.memberIds.includes(viewerId));
  const fit =
    viewerCard && cardStatus(viewerCard) === 'PUBLIC' && !viewerHasTeam ? matchCandidateToTeam(viewerCard, team, teamCards(db, team)) : undefined;
  return {
    team,
    capacity,
    openSeats: openSeats(team, capacity),
    pendingApplies: db.applications.filter((app) => app.teamId === team.id && app.direction === 'APPLY' && app.status === 'PENDING').length,
    myApplicationStatus: myApplication?.status,
    fit,
  };
};

const toView = (db: MockDb, app: TeamApplication): ApplicationView => {
  const team = db.teams.find((item) => item.id === app.teamId)!;
  return { application: app, team: { id: team.id, name: team.name }, applicant: db.accounts.find((account) => account.id === app.applicantId)! };
};

const mutate = async (operation: string, change: (db: MockDb) => MockDb) => {
  await latency(350);
  fail(operation);
  commit(change(getDb()));
};

export const mockDataSource: DataSource = {
  kind: 'mock',

  session: {
    async me() {
      await latency(150);
      const db = getDb();
      return db.accounts.find((item) => item.id === db.currentAccountId) ?? null;
    },
    async signOut() {
      await latency(150);
      commit({ ...getDb(), currentAccountId: null });
    },
    async signIn(email, password) {
      await latency(350);
      fail('signIn');
      const result = await authRules.signIn(getDb(), email, password);
      commit(result.db);
      return result.db.accounts.find((account) => account.id === result.accountId)!;
    },
    async requestSignupCode(email) {
      await latency(350);
      fail('sendCode');
      commit(authRules.requestCode(getDb(), email, 'SIGNUP'));
    },
    async verifySignupCode(email, code) {
      await latency();
      fail('verifyCode');
      commit(authRules.verifyCode(getDb(), email, 'SIGNUP', code));
    },
    async signUp(input) {
      await latency(350);
      fail('signUp');
      const result = await authRules.signUp(getDb(), input);
      commit(result.db);
      return result.db.accounts.find((account) => account.id === result.accountId)!;
    },
    async requestPasswordReset(email) {
      await latency(350);
      fail('sendCode');
      commit(authRules.requestCode(getDb(), email, 'RESET'));
    },
    async verifyResetCode(email, code) {
      await latency();
      fail('verifyCode');
      commit(authRules.verifyCode(getDb(), email, 'RESET', code));
    },
    async resetPassword(email, code, newPassword) {
      await latency(350);
      fail('resetPassword');
      commit(await authRules.resetPassword(getDb(), email, code, newPassword));
    },
    oauthStartUrl(provider) {
      // 목업은 제공자 화면 없이 바로 콜백으로 돌아온다. http 어댑터는 백엔드 OAuth 시작 주소를 돌려준다.
      return `/oauth/callback?provider=${provider}&code=mock-${provider}`;
    },
    async oauthExchange(provider, code) {
      await latency(400);
      fail('oauth');
      if (!code.startsWith('mock-')) throw new DataError('로그인을 완료하지 못했어요. 다시 시도해 주세요.', 'INVALID');
      // 목업: localStorage 실패 스위치에 oauthConflict를 넣으면 이메일 계정과 겹치는 경우(10-D3)를 재현한다.
      const conflict = shouldFail('oauthConflict');
      const label = provider === 'google' ? 'Google' : '카카오';
      const profile = conflict
        ? { subject: `${provider}-conflict`, email: 'user1@example.com', name: '김수강' }
        : { subject: `${provider}-demo`, email: `${provider}.demo@example.com`, name: `${label} 사용자` };
      const result = authRules.oauthSignIn(getDb(), provider, profile);
      commit(result.db);
      return result.db.accounts.find((account) => account.id === result.accountId)!;
    },
    async updateProfileImage(file) {
      await latency(400);
      fail('profileImage');
      const me = requireMe();
      const profileImageUrl = file ? await toSmallDataUrl(file) : null;
      const db = getDb();
      const next = { ...me, profileImageUrl };
      commit({ ...db, accounts: db.accounts.map((account) => (account.id === me.id ? next : account)) });
      return next;
    },
  },

  workspaces: {
    async listMine() {
      await latency();
      fail('workspaces');
      const me = requireMe();
      return getDb()
        .workspaces.filter((workspace) => workspace.members.some((member) => member.accountId === me.id))
        .map<Workspace>((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          memberCount: workspace.members.length,
          myRole: workspace.members.find((member) => member.accountId === me.id)!.role,
        }));
    },
    async create(input) {
      await latency(350);
      fail('createWorkspace');
      const me = requireMe();
      const result = await authRules.createWorkspace(getDb(), me.id, input);
      commit(result.db);
      return { id: result.workspaceId, name: input.name.trim(), memberCount: 1, myRole: 'OWNER' };
    },
    async get(workspaceId) {
      await latency();
      const { workspace, membership } = findWorkspaceOfMe(workspaceId);
      return { id: workspace.id, name: workspace.name, memberCount: workspace.members.length, myRole: membership.role };
    },
    async listMembers(workspaceId) {
      await latency();
      fail('members');
      const { me, workspace } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      return workspace.members.map<Member>((member) => ({
        account: db.accounts.find((account) => account.id === member.accountId)!,
        role: member.role,
        teamId: member.teamId,
        cardState: memberCardState(db.cards[member.accountId] ?? emptyCard()),
        card: visibleCard(db.cards[member.accountId] ?? emptyCard(), member.accountId === me.id),
      }));
    },
    async getMember(workspaceId, accountId) {
      await latency();
      const { me, workspace } = findWorkspaceOfMe(workspaceId);
      const member = workspace.members.find((item) => item.accountId === accountId);
      if (!member) throw new DataError('멤버를 찾을 수 없어요.', 'NOT_FOUND');
      const db = getDb();
      return {
        account: db.accounts.find((account) => account.id === accountId)!,
        role: member.role,
        teamId: member.teamId,
        cardState: memberCardState(db.cards[accountId] ?? emptyCard()),
        card: visibleCard(db.cards[accountId] ?? emptyCard(), accountId === me.id),
      };
    },
  },

  cards: {
    async getMine() {
      await latency();
      const me = requireMe();
      return getDb().cards[me.id] ?? emptyCard();
    },
    async saveMine(card) {
      await latency(400);
      fail('saveCard');
      const me = requireMe();
      if (card.desiredRole1 && card.desiredRole1 === card.desiredRole2) {
        throw new DataError('희망 역할 1순위와 2순위는 서로 달라야 해요.', 'INVALID');
      }
      const db = getDb();
      const previous = db.cards[me.id] ?? emptyCard();
      const next: PrCard = {
        ...card,
        // 최초 동의 시각은 서버가 기록한다(11 §6.2).
        consentGivenAt: previous.consentGivenAt ?? card.consentGivenAt,
        // 필수 항목이 모자라면 공개할 수 없다(11 §5.2).
        cardVisible: card.cardVisible && isRequiredComplete(card),
      };
      commit({ ...db, cards: { ...db.cards, [me.id]: next } });
      return next;
    },
    async setVisibility(visible) {
      await latency();
      const me = requireMe();
      const db = getDb();
      const card = db.cards[me.id] ?? emptyCard();
      if (visible && !isRequiredComplete(card)) throw new DataError('희망 역할과 주간 가용 시간을 먼저 입력해 주세요.', 'INVALID');
      const next = { ...card, cardVisible: visible };
      commit({ ...db, cards: { ...db.cards, [me.id]: next } });
      return next;
    },
    async searchHashtags(keyword) {
      await latency(120);
      const query = keyword.trim().toLowerCase();
      if (!query) return [];
      const all = new Set(Object.values(getDb().cards).flatMap((card) => card.hashtags));
      return [...all].filter((tag) => tag.toLowerCase().includes(query)).slice(0, 8);
    },
  },

  announcements: {
    async listRecent(workspaceId, limit) {
      await latency();
      fail('announcements');
      const { me } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      const myTeamNames = db.teams.filter((team) => team.workspaceId === workspaceId && team.memberIds.includes(me.id)).map((team) => team.name);
      return db.announcements
        // 팀 공지는 그 팀 멤버에게만 보인다.
        .filter((item) => item.workspaceId === workspaceId && (!item.teamName || myTeamNames.includes(item.teamName)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(({ workspaceId: _ignored, ...item }) => item);
    },
  },

  teamBuilding: {
    async getSession(workspaceId) {
      await latency();
      findWorkspaceOfMe(workspaceId);
      return rules.findSession(getDb(), workspaceId);
    },
    async listTeams(workspaceId) {
      await latency();
      findWorkspaceOfMe(workspaceId);
      return getDb().teams.filter((team) => team.workspaceId === workspaceId);
    },
    async getBoard(workspaceId) {
      await latency();
      fail('board');
      const { me, membership } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      const session = rules.findSession(db, workspaceId);
      if (!session) throw new DataError('진행 중인 팀 빌딩이 없어요.', 'NOT_FOUND');
      const myTeam = db.teams.find((team) => team.workspaceId === workspaceId && team.memberIds.includes(me.id));
      const mine = db.applications.filter((app) => app.sessionId === session.id && app.status === 'PENDING');
      const isLeader = myTeam?.leaderId === me.id;
      const sentPending = mine.filter((app) => (app.direction === 'APPLY' ? app.applicantId === me.id : isLeader && app.teamId === myTeam?.id)).length;
      const receivedPending = mine.filter((app) => (app.direction === 'SCOUT' ? app.applicantId === me.id : isLeader && app.teamId === myTeam?.id)).length;
      const card = db.cards[me.id];
      return {
        session,
        me: {
          isParticipant: membership.role === 'MEMBER',
          cardPublic: Boolean(card && cardStatus(card) === 'PUBLIC'),
          teamId: myTeam?.id,
          isLeader,
          sentPending,
          receivedPending,
        },
        teams: db.teams.filter((team) => team.workspaceId === workspaceId).map((team) => summarize(db, team, me.id, session.teamCapacity)),
      };
    },
    async getTeamDetail(workspaceId, teamId) {
      await latency();
      const { me } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      const session = rules.findSession(db, workspaceId);
      const team = db.teams.find((item) => item.id === teamId && item.workspaceId === workspaceId);
      if (!session || !team) throw new DataError('팀을 찾을 수 없어요.', 'NOT_FOUND');
      const isLeader = team.leaderId === me.id;
      return {
        ...summarize(db, team, me.id, session.teamCapacity),
        members: team.memberIds.map((id) => toMember(db, workspaceId, id, me.id)),
        // 개인값 대신 팀 집계만 보여 준다(12-D6).
        aggregate: aggregateTeam(teamCards(db, team)),
        receivedApplications: isLeader
          ? db.applications
              .filter((app) => app.sessionId === session.id && app.teamId === team.id && app.direction === 'APPLY')
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((app) => toView(db, app))
          : undefined,
      };
    },
    async recommendations(workspaceId) {
      await latency();
      fail('recommendations');
      const { me, membership } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      const session = rules.findSession(db, workspaceId);
      const myCard = db.cards[me.id];
      if (!session || membership.role !== 'MEMBER' || !myCard || cardStatus(myCard) !== 'PUBLIC') return [];
      const workspace = db.workspaces.find((item) => item.id === workspaceId)!;
      const myTeam = db.teams.find((team) => team.workspaceId === workspaceId && team.memberIds.includes(me.id));
      if (!myTeam) {
        return db.teams
          .filter((team) => team.workspaceId === workspaceId && openSeats(team, session.teamCapacity) > 0)
          .map((team) => ({ kind: 'TEAM' as const, summary: summarize(db, team, me.id, session.teamCapacity), fit: matchCandidateToTeam(myCard, team, teamCards(db, team)) }))
          .filter((item) => item.fit.score > 0)
          .sort((a, b) => b.fit.score - a.fit.score)
          .slice(0, 3);
      }
      const cards = teamCards(db, myTeam);
      return workspace.members
        .filter((member) => member.role === 'MEMBER' && !member.teamId && db.cards[member.accountId] && cardStatus(db.cards[member.accountId]) === 'PUBLIC')
        .map((member) => ({
          kind: 'MEMBER' as const,
          member: toMember(db, workspaceId, member.accountId, me.id),
          fit: matchCandidateToTeam(db.cards[member.accountId], myTeam, cards),
          canScout: myTeam.leaderId === me.id && session.status === 'OPEN' && openSeats(myTeam, session.teamCapacity) > 0,
        }))
        .filter((item) => item.fit.score > 0)
        .sort((a, b) => b.fit.score - a.fit.score)
        .slice(0, 3);
    },
    async inbox(workspaceId) {
      await latency();
      fail('inbox');
      const { me } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      const session = rules.findSession(db, workspaceId);
      if (!session) return { received: [], sent: [] };
      const myTeam = db.teams.find((team) => team.workspaceId === workspaceId && team.memberIds.includes(me.id));
      const ledTeamId = myTeam?.leaderId === me.id ? myTeam.id : undefined;
      const apps = db.applications.filter((app) => app.sessionId === session.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const received = apps.filter((app) => (app.direction === 'SCOUT' ? app.applicantId === me.id : app.teamId === ledTeamId));
      const sent = apps.filter((app) => (app.direction === 'APPLY' ? app.applicantId === me.id : app.teamId === ledTeamId));
      return { received: received.map((app) => toView(db, app)), sent: sent.map((app) => toView(db, app)) };
    },
    async apply(workspaceId, teamId, message) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('apply', (db) => rules.apply(db, workspaceId, me.id, teamId, message));
    },
    async scout(workspaceId, accountId, message) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('scout', (db) => rules.scout(db, workspaceId, me.id, accountId, message));
    },
    async accept(workspaceId, applicationId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('accept', (db) => rules.accept(db, workspaceId, me.id, applicationId));
    },
    async decline(workspaceId, applicationId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('decline', (db) => rules.decline(db, workspaceId, me.id, applicationId));
    },
    async withdraw(workspaceId, applicationId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('withdraw', (db) => rules.withdraw(db, workspaceId, me.id, applicationId));
    },
    async createTeam(workspaceId, input) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await latency(350);
      fail('createTeam');
      const result = rules.createTeam(getDb(), workspaceId, me.id, input);
      commit(result.db);
      return { teamId: result.teamId };
    },

    async getManageView(workspaceId) {
      await latency();
      fail('manage');
      const { me } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      sessionRules.requireManager(db, workspaceId, me.id);
      const session = rules.findSession(db, workspaceId);
      const participants = sessionRules.participantsOf(db, workspaceId);
      const capacity = session?.teamCapacity ?? 0;
      return {
        session,
        participants: participants.length,
        assigned: participants.filter((member) => member.teamId).length,
        unassigned: participants.filter((member) => !member.teamId).map((member) => toMember(db, workspaceId, member.accountId, me.id)),
        cardNotWritten: participants.filter((member) => memberCardState(db.cards[member.accountId] ?? emptyCard()) === 'NOT_WRITTEN').length,
        teams: db.teams
          .filter((team) => team.workspaceId === workspaceId)
          .map((team) => ({ team, members: team.memberIds.map((id) => toMember(db, workspaceId, id, me.id)), openSeats: openSeats(team, capacity) })),
        pendingApplications: session ? db.applications.filter((app) => app.sessionId === session.id && app.status === 'PENDING').length : 0,
      };
    },
    async createSession(workspaceId, input) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('createSession', (db) => sessionRules.createSession(db, workspaceId, me.id, input));
    },
    async updateSession(workspaceId, input) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('updateSession', (db) => sessionRules.updateSession(db, workspaceId, me.id, input));
    },
    async openSession(workspaceId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('openSession', (db) => sessionRules.openSession(db, workspaceId, me.id));
    },
    async closeSession(workspaceId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('closeSession', (db) => sessionRules.closeSession(db, workspaceId, me.id));
    },
    async assignMember(workspaceId, accountId, teamId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('assign', (db) => sessionRules.assignMember(db, workspaceId, me.id, accountId, teamId));
    },
    async unassignMember(workspaceId, accountId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('unassign', (db) => sessionRules.unassignMember(db, workspaceId, me.id, accountId));
    },
    async addTeamSlot(workspaceId, name) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await latency(350);
      fail('addTeamSlot');
      const result = sessionRules.addTeamSlot(getDb(), workspaceId, me.id, name);
      commit(result.db);
      return { teamId: result.teamId };
    },
    async randomAssign(workspaceId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await latency(350);
      fail('randomAssign');
      const result = sessionRules.randomAssign(getDb(), workspaceId, me.id);
      commit(result.db);
      return { assigned: result.assigned, remaining: result.remaining };
    },
    async resolveSession(workspaceId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('resolveSession', (db) => sessionRules.resolveSession(db, workspaceId, me.id));
    },
  },

  invites: {
    async get(code) {
      await latency();
      fail('invite');
      return authRules.getInvite(getDb(), code, getDb().currentAccountId);
    },
    async join(code, password) {
      await latency(350);
      fail('join');
      const me = requireMe();
      const { db, result } = await authRules.joinByInvite(getDb(), code, me.id, password);
      commit(db);
      return result;
    },
  },

  teamSpace: {
    async get(workspaceId, teamId) {
      await latency();
      fail('teamSpace');
      const me = requireMe();
      const db = getDb();
      const access = kanbanRules.teamAccess(db, workspaceId, teamId, me.id);
      const team = db.teams.find((item) => item.id === teamId)!;
      const staff = db.workspaces
        .find((item) => item.id === workspaceId)!
        .members.filter((member) => member.role !== 'MEMBER')
        .map((member) => db.accounts.find((account) => account.id === member.accountId)!);
      return { team, members: team.memberIds.map((id) => toMember(db, workspaceId, id, me.id)), staff, access };
    },
    async overview(workspaceId, teamId) {
      await latency();
      fail('overview');
      const me = requireMe();
      const db = getDb();
      const access = kanbanRules.teamAccess(db, workspaceId, teamId, me.id);
      const teamSchedules = db.schedules.filter((item) => item.teamId === teamId && !item.personal);
      const nowIso = new Date().toISOString();
      const next = teamSchedules.filter((item) => item.endAt >= nowIso).sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
      const latest = db.announcements.filter((item) => item.teamId === teamId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return {
        progress: progressOf(db.tasks.filter((task) => task.teamId === teamId)),
        // 팀 내부 일정과 공지는 팀원에게만 보여 준다(13-D1).
        nextSchedule: access.isMember && next ? { id: next.id, title: next.title, type: next.type, startAt: next.startAt } : undefined,
        latestAnnouncement: access.isMember && latest ? { id: latest.id, title: latest.title, createdAt: latest.createdAt } : undefined,
        scheduleCount: teamSchedules.length,
        rolesConfirmed: db.rolesConfirmedTeamIds.includes(teamId),
      };
    },
    async confirmRoles(workspaceId, teamId) {
      const me = requireMe();
      await mutate('confirmRoles', (db) => {
        if (!kanbanRules.teamAccess(db, workspaceId, teamId, me.id).isLeader) throw new DataError('팀장만 역할 확정을 표시할 수 있어요.', 'FORBIDDEN');
        return db.rolesConfirmedTeamIds.includes(teamId) ? db : { ...db, rolesConfirmedTeamIds: [...db.rolesConfirmedTeamIds, teamId] };
      });
    },
    async listTasks(workspaceId, teamId) {
      await latency();
      fail('tasks');
      const me = requireMe();
      const db = getDb();
      kanbanRules.teamAccess(db, workspaceId, teamId, me.id);
      return db.tasks.filter((task) => task.teamId === teamId);
    },
    async createTask(workspaceId, teamId, input) {
      const me = requireMe();
      await latency(350);
      fail('createTask');
      const result = kanbanRules.createTask(getDb(), workspaceId, teamId, me.id, input);
      commit(result.db);
      return { taskId: result.taskId };
    },
    async updateTask(workspaceId, teamId, taskId, input) {
      const me = requireMe();
      await mutate('updateTask', (db) => kanbanRules.updateTask(db, workspaceId, teamId, me.id, taskId, input));
    },
    async transitionTask(workspaceId, teamId, taskId, action, note) {
      const me = requireMe();
      await mutate('transitionTask', (db) => kanbanRules.transition(db, workspaceId, teamId, me.id, taskId, action, note));
    },
    async deleteTask(workspaceId, teamId, taskId) {
      const me = requireMe();
      await mutate('deleteTask', (db) => kanbanRules.deleteTask(db, workspaceId, teamId, me.id, taskId));
    },
    async addComment(workspaceId, teamId, taskId, content) {
      const me = requireMe();
      await mutate('addComment', (db) => kanbanRules.addComment(db, workspaceId, teamId, me.id, taskId, content));
    },
  },

  dashboard: {
    async get(workspaceId) {
      await latency();
      fail('dashboard');
      const { me, workspace } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      sessionRules.requireManager(db, workspaceId, me.id);
      const participants = sessionRules.participantsOf(db, workspaceId);
      const written = participants.filter((member) => memberCardState(db.cards[member.accountId] ?? emptyCard()) !== 'NOT_WRITTEN').length;
      const session = rules.findSession(db, workspaceId);
      const teams = db.teams.filter((team) => team.workspaceId === workspaceId);
      const teamIds = new Set(teams.map((team) => team.id));
      const tasks = db.tasks.filter((task) => teamIds.has(task.teamId));
      // 승인 대기 = 완료 요청 상태의 칸반 태스크(13 §4.5와 14 §4.2를 같은 데이터로 본다)
      const pending = tasks.filter((task) => task.status === 'APPROVAL_PENDING').sort((a, b) => (b.completionRequestedAt ?? '').localeCompare(a.completionRequestedAt ?? ''));
      const account = (id: string) => db.accounts.find((item) => item.id === id)!;
      const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? '알 수 없는 팀';
      const inactive: DashboardAlert[] = teams.flatMap((team) => {
        // 칸반 마지막 갱신 시각. 태스크가 하나도 없는 팀은 아직 시작 전이라 신호로 보지 않는다.
        const lastActivity = tasks.filter((task) => task.teamId === team.id).reduce<string>((latest, task) => (task.updatedAt > latest ? task.updatedAt : latest), '');
        if (!lastActivity) return [];
        const days = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
        return days >= INACTIVE_DAYS ? [{ kind: 'INACTIVE_TEAM' as const, teamId: team.id, teamName: team.name, days }] : [];
      });
      const banCounts = new Map<string, number>();
      db.bans.filter((ban) => ban.workspaceId === workspaceId).forEach((ban) => banCounts.set(ban.accountId, (banCounts.get(ban.accountId) ?? 0) + 1));
      return {
        workspace: { name: workspace.name, memberCount: workspace.members.length, capacity: workspace.capacity },
        cards: { participants: participants.length, written, notWritten: participants.length - written },
        teamBuilding: session
          ? {
              status: session.status,
              closesAt: session.closesAt,
              assigned: participants.filter((member) => member.teamId).length,
              unassigned: participants.filter((member) => !member.teamId).length,
            }
          : null,
        progress: teams
          .filter((team) => team.memberIds.length > 0)
          .map((team) => ({
            teamId: team.id,
            teamName: team.name,
            completionRate: progressOf(tasks.filter((task) => task.teamId === team.id)).completionRate,
            pendingApprovals: pending.filter((item) => item.teamId === team.id).length,
          })),
        approvals: pending.map((task) => ({
          id: task.id,
          teamId: task.teamId,
          teamName: teamName(task.teamId),
          taskTitle: task.title,
          requester: account(task.completionRequestedBy ?? task.assigneeIds[0] ?? task.createdBy),
          requestedAt: task.completionRequestedAt ?? task.updatedAt,
        })),
        alerts: [...inactive, ...[...banCounts.entries()].map(([accountId, count]) => ({ kind: 'BAN_HISTORY' as const, account: account(accountId), count }))],
      };
    },
    async approve(workspaceId, approvalId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('approve', (db) => {
        sessionRules.requireManager(db, workspaceId, me.id);
        const task = db.tasks.find((item) => item.id === approvalId);
        if (!task) throw new DataError('승인 요청을 찾을 수 없어요.', 'NOT_FOUND');
        if (task.status !== 'APPROVAL_PENDING') throw new DataError('이미 처리된 요청이에요.', 'CONFLICT');
        // 대시보드 승인도 칸반 승인과 같은 규칙으로 처리한다(매니저 개입 승인, 승인자 기록).
        return kanbanRules.transition(db, workspaceId, task.teamId, me.id, task.id, 'approve');
      });
    },
    async remindCardWriters(workspaceId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await latency(350);
      fail('remind');
      const db = getDb();
      sessionRules.requireManager(db, workspaceId, me.id);
      const targets = sessionRules
        .participantsOf(db, workspaceId)
        .filter((member) => memberCardState(db.cards[member.accountId] ?? emptyCard()) === 'NOT_WRITTEN')
        .map((member) => member.accountId);
      if (targets.length === 0) throw new DataError('카드를 쓰지 않은 멤버가 없어요.', 'CONFLICT');
      commit({ ...db, reminders: [...db.reminders, { workspaceId, accountIds: targets, sentAt: new Date().toISOString() }] });
      return { count: targets.length };
    },
  },
};

/** 목업 계정 전환(시연용). 실제 인증이 붙으면 제거한다. */
export const mockPersonas = [
  { id: 'u-student', label: '수강생 김수강', description: '2026 하계 부트캠프 멤버, 카드 미작성' },
  { id: 'u-instructor', label: '강사 박강사', description: '2026 하계 부트캠프 개설자' },
  { id: 'u-manager', label: '매니저 정매니저', description: '2026 하계 부트캠프 매니저' },
  { id: 'u-01', label: '팀장 김철수', description: '2026 하계 부트캠프 알파팀 팀장' },
] as const;

/** 목업 전용: 발송한 인증 코드를 화면 안내로 보여 주려고 읽는다. 실제 서비스에서는 메일로만 받는다. */
export const peekMockCode = (email: string, purpose: 'SIGNUP' | 'RESET') => {
  const matches = getDb().verifications.filter((item) => item.email === email.trim().toLowerCase() && item.purpose === purpose);
  return matches[matches.length - 1]?.code;
};

export const switchMockPersona = (accountId: string) => commit({ ...getDb(), currentAccountId: accountId });
