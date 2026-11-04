import { cardStatus, emptyCard, isRequiredComplete, type PrCard } from '@/renewal/domain/card';
import type { Member, Workspace } from '@/renewal/domain/workspace';
import { DataError, type DataSource } from '../ports';
import { commit, getDb, latency, shouldFail } from './db';

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
 * MBTI를 숨긴 경우 값도 내려보내지 않는다(11-D4).
 */
const visibleCard = (card: PrCard, isMe: boolean): PrCard => {
  if (isMe) return card;
  if (cardStatus(card) !== 'PUBLIC') return { ...emptyCard(), consentGivenAt: card.consentGivenAt, cardVisible: card.cardVisible };
  return card.mbtiHidden ? { ...card, mbti: undefined } : card;
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

  teamBuilding: {
    async getSession(workspaceId) {
      await latency();
      findWorkspaceOfMe(workspaceId);
      return getDb().sessions.find((session) => session.workspaceId === workspaceId) ?? null;
    },
    async listTeams(workspaceId) {
      await latency();
      findWorkspaceOfMe(workspaceId);
      return getDb().teams.filter((team) => team.workspaceId === workspaceId);
    },
  },
};

/** 목업 계정 전환(시연용). 실제 인증이 붙으면 제거한다. */
export const mockPersonas = [
  { id: 'u-student', label: '수강생 김수강', description: '2026 하계 부트캠프 멤버, 카드 미작성' },
  { id: 'u-instructor', label: '강사 박강사', description: '2026 하계 부트캠프 개설자' },
  { id: 'u-manager', label: '매니저 정매니저', description: '2026 하계 부트캠프 매니저' },
] as const;

export const switchMockPersona = (accountId: string) => commit({ ...getDb(), currentAccountId: accountId });
