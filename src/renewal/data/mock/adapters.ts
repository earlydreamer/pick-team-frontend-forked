import { cardStatus, emptyCard, isRequiredComplete, type PrCard } from '@/renewal/domain/card';
import type { Member, MemberCardState, Workspace } from '@/renewal/domain/workspace';
import { DataError, type DataSource } from '../ports';
import { aggregateTeam, matchCandidateToTeam } from '@/renewal/domain/matching';
import { openSeats, type ApplicationView, type Team, type TeamApplication, type TeamSummary } from '@/renewal/domain/teamBuilding';
import * as rules from './rules';
import * as sessionRules from './sessionRules';
import * as authRules from './authRules';
import * as kanbanRules from './kanbanRules';
import * as collabRules from './collabRules';
import * as teamSettingsRules from './teamSettingsRules';
import * as chatRules from './chatRules';
import * as notifyRules from './notifyRules';
import * as adminRules from './workspaceAdminRules';
import * as accountRules from './accountRules';
import * as wsAnnouncementRules from './workspaceAnnouncementRules';
import { runTimedEvents } from './timedRules';
import { withArchiveGuard } from './archiveGuard';
import * as reportRules from './reportRules';
import { defaultSettings, railCounts } from '@/renewal/domain/notification';
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

/** 서버 스케줄러 대신 알림을 조회할 때 시각 기반 알림을 계산한다(timedRules). 바뀐 것이 있을 때만 저장한다. */
const tickTimedEvents = () => {
  const db = getDb();
  const next = runTimedEvents(db);
  if (next !== db) commit(next);
};

const mutate = async (operation: string, change: (db: MockDb) => MockDb) => {
  await latency(350);
  fail(operation);
  commit(change(getDb()));
};

const baseSource: DataSource = {
  kind: 'mock',

  session: {
    async me() {
      await latency(150);
      const db = getDb();
      const account = db.accounts.find((item) => item.id === db.currentAccountId);
      // 정지된 계정은 로그인 상태를 끝낸다(17 §5.1 BANNED_SYSTEM).
      if (account?.suspendedAt) {
        commit({ ...db, currentAccountId: null });
        return null;
      }
      return account ?? null;
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
    async policyConsent() {
      await latency(100);
      return getDb().policyConsents[requireMe().id] ?? null;
    },
    async agreePolicies(agreements) {
      const me = requireMe();
      await mutate('agreePolicies', (db) => authRules.agreePolicies(db, me.id, agreements));
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
          archived: Boolean(workspace.archivedAt),
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
      return { id: workspace.id, name: workspace.name, memberCount: workspace.members.length, myRole: membership.role, archived: Boolean(workspace.archivedAt) };
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

  workspaceAdmin: {
    async getSettings(workspaceId) {
      await latency();
      fail('workspaceSettings');
      const { workspace, membership } = findWorkspaceOfMe(workspaceId);
      const invite = adminRules.currentInvite(getDb(), workspaceId);
      return {
        id: workspace.id,
        name: workspace.name,
        myRole: membership.role,
        memberCount: workspace.members.length,
        capacity: workspace.capacity,
        hasPassword: Boolean(workspace.passwordHash),
        archivedAt: workspace.archivedAt ?? null,
        invite:
          membership.role === 'MEMBER' || !invite
            ? null
            : { code: invite.code, expiresAt: invite.expiresAt, usedCount: invite.usedCount, expired: Boolean(invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) },
      };
    },
    async rename(workspaceId, name) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('renameWorkspace', (db) => adminRules.renameWorkspace(db, workspaceId, me.id, name));
    },
    async refreshInvite(workspaceId, days) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('refreshInvite', (db) => adminRules.refreshInvite(db, workspaceId, me.id, days));
      const invite = adminRules.currentInvite(getDb(), workspaceId)!;
      return { code: invite.code, expiresAt: invite.expiresAt, usedCount: invite.usedCount };
    },
    async changeRole(workspaceId, accountId, role) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('changeRole', (db) => adminRules.changeRole(db, workspaceId, me.id, accountId, role));
    },
    async transferOwnership(workspaceId, accountId, confirmName) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('transferOwnership', (db) => adminRules.transferOwnership(db, workspaceId, me.id, accountId, confirmName));
    },
    async kick(workspaceId, accountId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('kickMember', (db) => {
        const result = adminRules.kickMember(db, workspaceId, me.id, accountId);
        return result.successor ? notifyRules.onLeaderSucceeded(result.db, workspaceId, result.successor.teamId, result.successor.accountId, me.id) : result.db;
      });
    },
    async ban(workspaceId, accountId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('banMember', (db) => {
        const result = adminRules.banMember(db, workspaceId, me.id, accountId);
        const next = result.successor ? notifyRules.onLeaderSucceeded(result.db, workspaceId, result.successor.teamId, result.successor.accountId, me.id) : result.db;
        return notifyRules.onMemberBanned(next, workspaceId, accountId, me.id);
      });
    },
    async listBans(workspaceId) {
      await latency();
      fail('bans');
      const { me } = findWorkspaceOfMe(workspaceId);
      const db = getDb();
      sessionRules.requireManager(db, workspaceId, me.id);
      return db.bans
        .filter((ban) => ban.workspaceId === workspaceId)
        .sort((a, b) => b.bannedAt.localeCompare(a.bannedAt))
        .map((ban) => ({ account: db.accounts.find((account) => account.id === ban.accountId)!, bannedAt: ban.bannedAt }));
    },
    async unban(workspaceId, accountId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('unbanMember', (db) => adminRules.unbanMember(db, workspaceId, me.id, accountId));
    },
    async setPassword(workspaceId, password) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await latency(350);
      fail('workspacePassword');
      commit(await adminRules.setWorkspacePassword(getDb(), workspaceId, me.id, password));
    },
    async setArchived(workspaceId, archived) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('archiveWorkspace', (db) => adminRules.setArchived(db, workspaceId, me.id, archived));
    },
    async leave(workspaceId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('leaveWorkspace', (db) => adminRules.leaveWorkspace(db, workspaceId, me.id));
    },
    async remove(workspaceId, confirmName) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('deleteWorkspace', (db) => adminRules.deleteWorkspace(db, workspaceId, me.id, confirmName));
    },
  },

  reports: {
    async submit(input) {
      const me = requireMe();
      await mutate('submitReport', (db) => reportRules.submitReport(db, me.id, input));
    },
    async listAdmin(status) {
      await latency();
      fail('reports');
      return reportRules.listReports(getDb(), requireMe().id, status);
    },
    async startReview(reportId) {
      const me = requireMe();
      await mutate('startReview', (db) => reportRules.startReview(db, me.id, reportId));
    },
    async resolve(reportId, action, memo) {
      const me = requireMe();
      await mutate('resolveReport', (db) => reportRules.resolveReport(db, me.id, reportId, action, memo));
    },
    async listWorkspace(workspaceId) {
      await latency();
      fail('reports');
      return reportRules.listWorkspaceReports(getDb(), requireMe().id, workspaceId);
    },
    async getOpenCount(workspaceId) {
      await latency(100);
      return reportRules.openWorkspaceReportCount(getDb(), requireMe().id, workspaceId);
    },
    async startWorkspaceReview(workspaceId, reportId) {
      const me = requireMe();
      await mutate('startReview', (db) => reportRules.startWorkspaceReview(db, me.id, workspaceId, reportId));
    },
    async resolveInWorkspace(workspaceId, reportId, action, memo) {
      const me = requireMe();
      await mutate('resolveReport', (db) => reportRules.resolveInWorkspace(db, me.id, workspaceId, reportId, action, memo));
    },
    async escalate(workspaceId, reportId, memo) {
      const me = requireMe();
      await mutate('escalateReport', (db) => reportRules.escalateReport(db, me.id, workspaceId, reportId, memo));
    },
  },

  account: {
    async myData() {
      await latency();
      fail('myData');
      return accountRules.myData(getDb(), requireMe().id);
    },
    async updateName(name) {
      const me = requireMe();
      await mutate('updateName', (db) => accountRules.updateName(db, me.id, name));
    },
    async changePassword(current, next) {
      const me = requireMe();
      await latency(350);
      fail('changePassword');
      commit(await accountRules.changePassword(getDb(), me.id, current, next));
    },
    async deleteAccount(confirm) {
      const me = requireMe();
      await latency(500);
      fail('deleteAccount');
      commit(await accountRules.deleteAccount(getDb(), me.id, confirm));
    },
  },

  cards: {
    async deleteMine() {
      const me = requireMe();
      await mutate('deleteCard', (db) => accountRules.deleteCard(db, me.id));
    },
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
    async listWorkspace(workspaceId) {
      await latency();
      fail('workspaceAnnouncements');
      const { me } = findWorkspaceOfMe(workspaceId);
      return wsAnnouncementRules.listWorkspaceAnnouncements(getDb(), workspaceId, me.id);
    },
    async createWorkspace(workspaceId, input) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await latency(350);
      fail('createWorkspaceAnnouncement');
      const result = wsAnnouncementRules.createWorkspaceAnnouncement(getDb(), workspaceId, me.id, input);
      commit(notifyRules.onWorkspaceAnnouncement(result.db, workspaceId, result.announcementId, input.title.trim(), me.id));
      return result.announcementId;
    },
    async updateWorkspace(workspaceId, announcementId, input) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('updateWorkspaceAnnouncement', (db) => wsAnnouncementRules.updateWorkspaceAnnouncement(db, workspaceId, me.id, announcementId, input));
    },
    async removeWorkspace(workspaceId, announcementId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('deleteWorkspaceAnnouncement', (db) => wsAnnouncementRules.deleteWorkspaceAnnouncement(db, workspaceId, me.id, announcementId));
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
      await mutate('apply', (db) => {
        const next = rules.apply(db, workspaceId, me.id, teamId, message);
        return notifyRules.onApplicationCreated(next, workspaceId, notifyRules.lastApplicationId(next), me.id);
      });
    },
    async scout(workspaceId, accountId, message) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('scout', (db) => {
        const next = rules.scout(db, workspaceId, me.id, accountId, message);
        return notifyRules.onApplicationCreated(next, workspaceId, notifyRules.lastApplicationId(next), me.id);
      });
    },
    async accept(workspaceId, applicationId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('accept', (db) => notifyRules.onApplicationDecided(rules.accept(db, workspaceId, me.id, applicationId), workspaceId, applicationId, me.id));
    },
    async decline(workspaceId, applicationId) {
      const { me } = findWorkspaceOfMe(workspaceId);
      await mutate('decline', (db) => notifyRules.onApplicationDecided(rules.decline(db, workspaceId, me.id, applicationId), workspaceId, applicationId, me.id));
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
      await mutate('openSession', (db) => notifyRules.onSessionOpened(sessionRules.openSession(db, workspaceId, me.id), workspaceId, me.id));
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
      await mutate('resolveSession', (db) => notifyRules.onSessionResolved(sessionRules.resolveSession(db, workspaceId, me.id), workspaceId, me.id));
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
      commit(result.alreadyMember ? db : notifyRules.onWorkspaceJoined(db, result.workspaceId, me.id));
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
      commit(notifyRules.onTaskAssigned(result.db, workspaceId, teamId, result.taskId, input.assigneeIds, me.id));
      return { taskId: result.taskId };
    },
    async updateTask(workspaceId, teamId, taskId, input) {
      const me = requireMe();
      await mutate('updateTask', (db) => {
        const before = db.tasks.find((task) => task.id === taskId)?.assigneeIds ?? [];
        const next = kanbanRules.updateTask(db, workspaceId, teamId, me.id, taskId, input);
        // 새로 맡게 된 사람에게만 알린다.
        return notifyRules.onTaskAssigned(next, workspaceId, teamId, taskId, input.assigneeIds.filter((id) => !before.includes(id)), me.id);
      });
    },
    async transitionTask(workspaceId, teamId, taskId, action, note) {
      const me = requireMe();
      await mutate('transitionTask', (db) => {
        const requester = db.tasks.find((task) => task.id === taskId)?.completionRequestedBy;
        const next = kanbanRules.transition(db, workspaceId, teamId, me.id, taskId, action, note);
        return notifyRules.onTaskTransition(next, workspaceId, teamId, taskId, action, requester, me.id);
      });
    },
    async deleteTask(workspaceId, teamId, taskId) {
      const me = requireMe();
      await mutate('deleteTask', (db) => kanbanRules.deleteTask(db, workspaceId, teamId, me.id, taskId));
    },
    async addComment(workspaceId, teamId, taskId, content) {
      const me = requireMe();
      await mutate('addComment', (db) => kanbanRules.addComment(db, workspaceId, teamId, me.id, taskId, content));
    },
    async listSchedules(workspaceId, teamId) {
      await latency();
      fail('schedules');
      return collabRules.listSchedules(getDb(), workspaceId, teamId, requireMe().id);
    },
    async createSchedule(workspaceId, teamId, input) {
      const me = requireMe();
      await latency(350);
      fail('createSchedule');
      const result = collabRules.createSchedule(getDb(), workspaceId, teamId, me.id, input);
      commit(notifyRules.onScheduleCreated(result.db, workspaceId, teamId, result.scheduleId, me.id));
      return { scheduleId: result.scheduleId };
    },
    async updateSchedule(workspaceId, teamId, scheduleId, input) {
      const me = requireMe();
      await mutate('updateSchedule', (db) => collabRules.updateSchedule(db, workspaceId, teamId, me.id, scheduleId, input));
    },
    async deleteSchedule(workspaceId, teamId, scheduleId) {
      const me = requireMe();
      await mutate('deleteSchedule', (db) => collabRules.deleteSchedule(db, workspaceId, teamId, me.id, scheduleId));
    },
    async listPosts(workspaceId, teamId) {
      await latency();
      fail('posts');
      return collabRules.listPosts(getDb(), workspaceId, teamId, requireMe().id);
    },
    async createPost(workspaceId, teamId, input) {
      const me = requireMe();
      await latency(350);
      fail('createPost');
      const result = collabRules.createPost(getDb(), workspaceId, teamId, me.id, input);
      commit(result.db);
      return { postId: result.postId };
    },
    async updatePost(workspaceId, teamId, postId, input) {
      const me = requireMe();
      await mutate('updatePost', (db) => collabRules.updatePost(db, workspaceId, teamId, me.id, postId, input));
    },
    async deletePost(workspaceId, teamId, postId) {
      const me = requireMe();
      await mutate('deletePost', (db) => collabRules.deletePost(db, workspaceId, teamId, me.id, postId));
    },
    async addPostComment(workspaceId, teamId, postId, content) {
      const me = requireMe();
      await mutate('addPostComment', (db) => notifyRules.onPostCommented(collabRules.addPostComment(db, workspaceId, teamId, me.id, postId, content), workspaceId, teamId, postId, me.id));
    },
    async deletePostComment(workspaceId, teamId, postId, commentId) {
      const me = requireMe();
      await mutate('deletePostComment', (db) => collabRules.deletePostComment(db, workspaceId, teamId, me.id, postId, commentId));
    },
    async listAnnouncements(workspaceId, teamId) {
      await latency();
      fail('teamAnnouncements');
      return collabRules.listTeamAnnouncements(getDb(), workspaceId, teamId, requireMe().id);
    },
    async createAnnouncement(workspaceId, teamId, input) {
      const me = requireMe();
      await latency(350);
      fail('createAnnouncement');
      const result = collabRules.createAnnouncement(getDb(), workspaceId, teamId, me.id, input);
      commit(notifyRules.onAnnouncementCreated(result.db, workspaceId, teamId, input.title.trim(), me.id));
      return { announcementId: result.announcementId };
    },
    async updateAnnouncement(workspaceId, teamId, announcementId, input) {
      const me = requireMe();
      await mutate('updateAnnouncement', (db) => collabRules.updateAnnouncement(db, workspaceId, teamId, me.id, announcementId, input));
    },
    async deleteAnnouncement(workspaceId, teamId, announcementId) {
      const me = requireMe();
      await mutate('deleteAnnouncement', (db) => collabRules.deleteAnnouncement(db, workspaceId, teamId, me.id, announcementId));
    },
    async updateTeamInfo(workspaceId, teamId, input) {
      const me = requireMe();
      await mutate('updateTeamInfo', (db) => teamSettingsRules.updateTeamInfo(db, workspaceId, teamId, me.id, input));
    },
    async requestDelegation(workspaceId, teamId, targetId) {
      const me = requireMe();
      await mutate('delegate', (db) => notifyRules.onDelegationRequested(teamSettingsRules.requestDelegation(db, workspaceId, teamId, me.id, targetId), workspaceId, teamId, me.id));
    },
    async cancelDelegation(workspaceId, teamId) {
      const me = requireMe();
      await mutate('cancelDelegation', (db) => teamSettingsRules.cancelDelegation(db, workspaceId, teamId, me.id));
    },
    async respondDelegation(workspaceId, teamId, accept) {
      const me = requireMe();
      await mutate('respondDelegation', (db) => {
        const previousLeader = db.teams.find((team) => team.id === teamId)?.leaderId ?? '';
        const next = teamSettingsRules.respondDelegation(db, workspaceId, teamId, me.id, accept);
        return accept ? notifyRules.onDelegationAccepted(next, workspaceId, teamId, previousLeader, me.id) : next;
      });
    },
    async removeMember(workspaceId, teamId, accountId) {
      const me = requireMe();
      await mutate('removeMember', (db) => teamSettingsRules.removeMember(db, workspaceId, teamId, me.id, accountId));
    },
    async leaveTeam(workspaceId, teamId) {
      const me = requireMe();
      await latency(350);
      fail('leaveTeam');
      const result = teamSettingsRules.leaveTeam(getDb(), workspaceId, teamId, me.id);
      commit(result.db);
      return { disbanded: result.disbanded };
    },
    async deleteTeam(workspaceId, teamId, confirmName) {
      const me = requireMe();
      await mutate('deleteTeam', (db) => teamSettingsRules.deleteTeam(db, workspaceId, teamId, me.id, confirmName));
    },
  },

  chat: {
    async listRooms(workspaceId) {
      await latency(150);
      fail('chatRooms');
      const me = requireMe();
      // 팀이 생기면 팀 방과 회의실을 바로 만든다(15-D3).
      const db = chatRules.ensureTeamRooms(getDb(), workspaceId);
      if (db !== getDb()) commit(db);
      return chatRules.listRooms(db, workspaceId, me.id);
    },
    async getRoom(workspaceId, roomId) {
      await latency(150);
      fail('chatRoom');
      return chatRules.getRoom(chatRules.ensureTeamRooms(getDb(), workspaceId), workspaceId, roomId, requireMe().id);
    },
    async listMessages(workspaceId, roomId) {
      await latency(150);
      fail('messages');
      return chatRules.listMessages(getDb(), workspaceId, roomId, requireMe().id);
    },
    async sendMessage(workspaceId, roomId, content) {
      const me = requireMe();
      await latency(300);
      fail('sendMessage');
      const result = chatRules.sendMessage(getDb(), workspaceId, roomId, me.id, content);
      commit(notifyRules.onChatMessage(result.db, workspaceId, roomId, me.id));
      return result.message;
    },
    async markRead(workspaceId, roomId) {
      const me = requireMe();
      commit(notifyRules.readChatNotifications(chatRules.markRead(getDb(), workspaceId, roomId, me.id), roomId, me.id));
    },
    async searchMessages(workspaceId, roomId, keyword) {
      await latency();
      fail('searchMessages');
      return chatRules.search(getDb(), workspaceId, roomId, requireMe().id, keyword);
    },
    async createRoom(workspaceId, input) {
      const me = requireMe();
      await latency(300);
      fail('createRoom');
      const result = chatRules.createGroup(getDb(), workspaceId, me.id, input);
      commit(result.db);
      return { roomId: result.roomId };
    },
    async openDm(workspaceId, accountId) {
      const me = requireMe();
      await latency(200);
      fail('openDm');
      const result = chatRules.openDm(getDb(), workspaceId, me.id, accountId);
      commit(result.db);
      return { roomId: result.roomId };
    },
    async renameRoom(workspaceId, roomId, title) {
      const me = requireMe();
      await mutate('renameRoom', (db) => chatRules.renameRoom(db, workspaceId, roomId, me.id, title));
    },
    async addMembers(workspaceId, roomId, memberIds) {
      const me = requireMe();
      await mutate('addMembers', (db) => chatRules.addMembers(db, workspaceId, roomId, me.id, memberIds));
    },
    async leaveRoom(workspaceId, roomId) {
      const me = requireMe();
      await mutate('leaveRoom', (db) => chatRules.leaveRoom(db, workspaceId, roomId, me.id));
    },
    async deleteRoom(workspaceId, roomId) {
      const me = requireMe();
      await mutate('deleteRoom', (db) => chatRules.deleteRoom(db, workspaceId, roomId, me.id));
    },
    async setMuted(workspaceId, roomId, muted) {
      const me = requireMe();
      await mutate('setMuted', (db) => chatRules.setMuted(db, workspaceId, roomId, me.id, muted));
    },
  },

  video: {
    async listChannels(workspaceId) {
      await latency(150);
      const me = requireMe();
      const db = chatRules.ensureTeamRooms(getDb(), workspaceId);
      if (db !== getDb()) commit(db);
      return chatRules.listChannels(db, workspaceId, me.id);
    },
    async getChannel(workspaceId, channelId) {
      await latency();
      fail('videoChannel');
      return chatRules.getChannel(getDb(), workspaceId, channelId, requireMe().id);
    },
    async join(workspaceId, channelId) {
      const me = requireMe();
      await mutate('videoJoin', (db) => chatRules.joinChannel(db, workspaceId, channelId, me.id));
    },
    async leave(workspaceId, channelId) {
      const me = requireMe();
      await mutate('videoLeave', (db) => chatRules.leaveChannel(db, workspaceId, channelId, me.id));
    },
  },

  notifications: {
    async list({ category, limit }) {
      await latency(150);
      fail('notifications');
      const me = requireMe();
      tickTimedEvents();
      const all = getDb()
        .notifications.filter((item) => item.accountId === me.id && (!category || item.category === category))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { items: all.slice(0, limit), hasMore: all.length > limit };
    },
    async unreadSummary() {
      await latency(100);
      tickTimedEvents();
      const db = getDb();
      const me = db.currentAccountId;
      const mine = db.notifications.filter((item) => item.accountId === me);
      const seenAt: Record<string, string> = {};
      Object.entries(db.workspaceSeenAt).forEach(([key, value]) => {
        const [accountId, workspaceId] = key.split(':');
        if (accountId === me) seenAt[workspaceId] = value;
      });
      return { total: mine.filter((item) => !item.read).length, byWorkspace: railCounts(mine, seenAt) };
    },
    async markWorkspaceSeen(workspaceId) {
      const me = requireMe();
      await mutate('workspaceSeen', (db) => ({ ...db, workspaceSeenAt: { ...db.workspaceSeenAt, [`${me.id}:${workspaceId}`]: new Date().toISOString() } }));
    },
    async markRead(id) {
      const me = requireMe();
      await mutate('markNotificationRead', (db) => ({ ...db, notifications: db.notifications.map((item) => (item.id === id && item.accountId === me.id ? { ...item, read: true } : item)) }));
    },
    async markAllRead(category) {
      const me = requireMe();
      await mutate('markAllRead', (db) => ({
        ...db,
        notifications: db.notifications.map((item) => (item.accountId === me.id && (!category || item.category === category) ? { ...item, read: true } : item)),
      }));
    },
    async remove(id) {
      const me = requireMe();
      await mutate('removeNotification', (db) => ({ ...db, notifications: db.notifications.filter((item) => !(item.id === id && item.accountId === me.id)) }));
    },
    async getSettings() {
      await latency(150);
      return getDb().notificationSettings[requireMe().id] ?? defaultSettings();
    },
    async updateSettings(settings) {
      const me = requireMe();
      await mutate('notificationSettings', (db) => ({ ...db, notificationSettings: { ...db.notificationSettings, [me.id]: settings } }));
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
      const reminded = { ...db, reminders: [...db.reminders, { workspaceId, accountIds: targets, sentAt: new Date().toISOString() }] };
      commit(notifyRules.onCardReminder(reminded, workspaceId, targets, me.id));
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
  { id: 'u-admin', label: '운영자', description: '시스템 관리자, 신고 처리' },
] as const;

/** 목업 전용: 발송한 인증 코드를 화면 안내로 보여 주려고 읽는다. 실제 서비스에서는 메일로만 받는다. */
export const peekMockCode = (email: string, purpose: 'SIGNUP' | 'RESET') => {
  const matches = getDb().verifications.filter((item) => item.email === email.trim().toLowerCase() && item.purpose === purpose);
  return matches[matches.length - 1]?.code;
};

export const switchMockPersona = (accountId: string) => commit({ ...getDb(), currentAccountId: accountId });

/** 보관된 워크스페이스의 쓰기를 막는 겹을 씌운다(archiveGuard). 화면은 이 데이터 소스만 쓴다. */
export const mockDataSource: DataSource = withArchiveGuard(baseSource, (workspaceId) => Boolean(getDb().workspaces.find((workspace) => workspace.id === workspaceId)?.archivedAt));
