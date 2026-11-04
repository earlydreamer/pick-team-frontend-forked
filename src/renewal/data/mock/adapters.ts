import { cardStatus, emptyCard, isRequiredComplete, type PrCard } from '@/renewal/domain/card';
import type { Member, MemberCardState, Workspace } from '@/renewal/domain/workspace';
import { DataError, type DataSource } from '../ports';
import { aggregateTeam, matchCandidateToTeam } from '@/renewal/domain/matching';
import { openSeats, type ApplicationView, type Team, type TeamApplication, type TeamSummary } from '@/renewal/domain/teamBuilding';
import * as rules from './rules';
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
  },
};

/** 목업 계정 전환(시연용). 실제 인증이 붙으면 제거한다. */
export const mockPersonas = [
  { id: 'u-student', label: '수강생 김수강', description: '2026 하계 부트캠프 멤버, 카드 미작성' },
  { id: 'u-instructor', label: '강사 박강사', description: '2026 하계 부트캠프 개설자' },
  { id: 'u-manager', label: '매니저 정매니저', description: '2026 하계 부트캠프 매니저' },
  { id: 'u-01', label: '팀장 김철수', description: '2026 하계 부트캠프 알파팀 팀장' },
] as const;

export const switchMockPersona = (accountId: string) => commit({ ...getDb(), currentAccountId: accountId });
