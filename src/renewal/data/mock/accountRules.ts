import { isPasswordValid, validateName } from '@/renewal/domain/auth';
import { emptyCard } from '@/renewal/domain/card';
import { defaultSettings } from '@/renewal/domain/notification';
import type { LoginMethod, MyData } from '@/renewal/domain/account';
import { DataError } from '../ports';
import type { MockDb } from './db';
import { hashPassword } from './authRules';
import { leaveWorkspace } from './workspaceAdminRules';

/*
 * 내 계정 규칙(17 §6.3, §6.4). 이름·비밀번호 변경, 카드 삭제, 계정 삭제, 내 데이터 열람.
 * 계정 삭제는 모든 워크스페이스를 나간 뒤 로그인 수단(이메일, 비밀번호, OAuth 연동)과 카드를 바로 지운다.
 * 이름은 남은 기록(메시지, 게시글)의 작성자 표시로 남고, 30일 뒤 익명화는 서버 배치의 몫이다.
 */

const accountOf = (db: MockDb, accountId: string) => {
  const account = db.accounts.find((item) => item.id === accountId);
  if (!account) throw new DataError('로그인이 필요해요.', 'UNAUTHORIZED');
  return account;
};

export const loginMethods = (db: MockDb, accountId: string): LoginMethod[] => [
  ...(db.credentials[accountId] ? (['EMAIL'] as const) : []),
  ...db.oauthLinks.filter((link) => link.accountId === accountId).map((link) => (link.provider === 'google' ? ('GOOGLE' as const) : ('KAKAO' as const))),
];

export const updateName = (db: MockDb, accountId: string, name: string): MockDb => {
  accountOf(db, accountId);
  const error = validateName(name);
  if (error) throw new DataError(error, 'INVALID');
  return { ...db, accounts: db.accounts.map((account) => (account.id === accountId ? { ...account, name: name.trim() } : account)) };
};

/** 이메일 계정만 바꿀 수 있다. 새 비밀번호는 가입 규칙을 따르고 지금 비밀번호와 달라야 한다. */
export const changePassword = async (db: MockDb, accountId: string, current: string, next: string): Promise<MockDb> => {
  const credential = db.credentials[accountId];
  if (!credential) throw new DataError('소셜 로그인 계정은 Pick Team 비밀번호가 없어요.', 'CONFLICT');
  if (credential.passwordHash !== (await hashPassword(current))) throw new DataError('지금 비밀번호가 맞지 않아요.', 'INVALID');
  if (!isPasswordValid(next, 'signup')) throw new DataError('새 비밀번호가 조건에 맞지 않아요.', 'INVALID');
  if (current === next) throw new DataError('새 비밀번호는 지금 비밀번호와 달라야 해요.', 'INVALID');
  return { ...db, credentials: { ...db.credentials, [accountId]: { passwordHash: await hashPassword(next) } } };
};

/** 카드만 삭제(17 §6.3). 동의 기록과 성향 정보를 함께 지워 카드 작성 전 상태로 돌린다. */
export const deleteCard = (db: MockDb, accountId: string): MockDb => {
  accountOf(db, accountId);
  return { ...db, cards: { ...db.cards, [accountId]: emptyCard() } };
};

/**
 * 계정을 지우기 전에 해야 할 일. 워크스페이스를 나갈 수 없는 상태면 지울 수 없다.
 * 개설자는 넘기거나 삭제해야 하고, 팀원이 있는 팀장은 위임해야 한다(13 §5.3, 14 §5.4).
 */
export const deletionBlockers = (db: MockDb, accountId: string) =>
  db.workspaces.flatMap((workspace) => {
    const member = workspace.members.find((item) => item.accountId === accountId);
    if (!member) return [];
    if (member.role === 'OWNER') {
      return [workspace.members.length > 1 ? `${workspace.name}: 개설자를 다른 멤버에게 넘겨 주세요.` : `${workspace.name}: 혼자 남은 워크스페이스를 삭제해 주세요.`];
    }
    const team = member.teamId ? db.teams.find((item) => item.id === member.teamId) : undefined;
    if (team && team.leaderId === accountId && team.memberIds.length > 1) return [`${workspace.name}: ${team.name} 팀장을 위임해 주세요.`];
    return [];
  });

/**
 * 계정 삭제(17 §6.4). 이메일 계정은 비밀번호를, 소셜 계정은 이메일을 다시 입력해 확인한다.
 * 모든 워크스페이스를 나가고 카드, 비밀번호, OAuth 연동, 알림, 수신 설정을 지운 뒤 로그아웃한다.
 * 이메일을 비워 같은 주소로 다시 가입할 수 있게 한다.
 */
export const deleteAccount = async (db: MockDb, accountId: string, confirm: string): Promise<MockDb> => {
  const account = accountOf(db, accountId);
  const blockers = deletionBlockers(db, accountId);
  if (blockers.length) throw new DataError(blockers[0], 'CONFLICT');
  const credential = db.credentials[accountId];
  if (credential) {
    if (credential.passwordHash !== (await hashPassword(confirm))) throw new DataError('비밀번호가 맞지 않아요.', 'INVALID');
  } else if (confirm.trim().toLowerCase() !== account.email.toLowerCase()) {
    throw new DataError('이메일이 맞지 않아요.', 'INVALID');
  }
  const left = db.workspaces.filter((workspace) => workspace.members.some((member) => member.accountId === accountId)).reduce((acc, workspace) => leaveWorkspace(acc, workspace.id, accountId), db);
  const { [accountId]: _credential, ...credentials } = left.credentials;
  const { [accountId]: _card, ...cards } = left.cards;
  const { [accountId]: _settings, ...notificationSettings } = left.notificationSettings;
  const { [accountId]: _consent, ...policyConsents } = left.policyConsents;
  return {
    ...left,
    currentAccountId: null,
    accounts: left.accounts.map((item) => (item.id === accountId ? { ...item, email: '', profileImageUrl: null } : item)),
    credentials,
    cards,
    notificationSettings,
    policyConsents,
    oauthLinks: left.oauthLinks.filter((link) => link.accountId !== accountId),
    notifications: left.notifications.filter((item) => item.accountId !== accountId),
    chatMutes: left.chatMutes.filter((key) => !key.endsWith(`:${accountId}`)),
  };
};

export const myData = (db: MockDb, accountId: string): MyData => {
  const account = accountOf(db, accountId);
  return {
    account,
    loginMethods: loginMethods(db, accountId),
    card: db.cards[accountId] ?? emptyCard(),
    workspaces: db.workspaces
      .filter((workspace) => workspace.members.some((member) => member.accountId === accountId))
      .map((workspace) => {
        const member = workspace.members.find((item) => item.accountId === accountId)!;
        const team = member.teamId ? db.teams.find((item) => item.id === member.teamId) : undefined;
        return { id: workspace.id, name: workspace.name, role: member.role, teamName: team?.name, teamLeader: team ? team.leaderId === accountId : undefined };
      }),
    notificationSettings: db.notificationSettings[accountId] ?? defaultSettings(),
    policyConsent: db.policyConsents[accountId] ?? null,
    deletionBlockers: deletionBlockers(db, accountId),
  };
};
