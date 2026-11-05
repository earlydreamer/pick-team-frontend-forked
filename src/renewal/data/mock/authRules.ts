import {
  CODE_PATTERN,
  CODE_TTL_MS,
  INVITE_CODE_PATTERN,
  isPasswordValid,
  isValidEmail,
  validateName,
  validateWorkspaceName,
  validateWorkspacePassword,
  type CreateWorkspaceInput,
  type InviteInfo,
  type JoinResult,
  type OAuthProvider,
  type SignUpInput,
} from '@/renewal/domain/auth';
import { DataError } from '../ports';
import { POLICY_VERSION, missingAgreement, type Agreements } from '@/renewal/domain/policy';
import type { MockDb, MockInvite, MockVerification } from './db';

/*
 * 인증·초대 규칙(10 §4~§5)을 목 저장소 위에서 구현한다. 백엔드 AuthService와 초대 API가 지킬 규칙을
 * 화면과 같은 기준으로 확인하려고 순수 함수로 두고 테스트한다. 비밀번호 해시는 비동기라 해당 함수만 async다.
 */

const HASH_SALT = 'pickteam-mock:';

/** 목업 저장소에 평문 비밀번호를 남기지 않으려는 해시다. 실제 비밀번호 저장 방식이 아니다. */
export const hashPassword = async (password: string) => {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(HASH_SALT + password));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const accountByEmail = (db: MockDb, email: string) => db.accounts.find((account) => account.email.toLowerCase() === normalizeEmail(email));
const randomCode = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
const randomId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ── 로그인 ── */

export const signIn = async (db: MockDb, email: string, password: string) => {
  const account = accountByEmail(db, email);
  const credential = account ? db.credentials[account.id] : undefined;
  // 계정 존재 여부가 드러나지 않도록 이메일과 비밀번호 오류를 같은 문구로 알린다.
  if (!account || !credential || credential.passwordHash !== (await hashPassword(password))) {
    throw new DataError('이메일 또는 비밀번호가 맞지 않아요.', 'INVALID');
  }
  return { db: { ...db, currentAccountId: account.id }, accountId: account.id };
};

/* ── 인증 코드(가입·비밀번호 재설정) ── */

const latestVerification = (db: MockDb, email: string, purpose: MockVerification['purpose']) => {
  const matches = db.verifications.filter((item) => item.email === normalizeEmail(email) && item.purpose === purpose);
  return matches[matches.length - 1];
};

const withoutVerification = (db: MockDb, email: string, purpose: MockVerification['purpose']): MockDb => ({
  ...db,
  verifications: db.verifications.filter((item) => !(item.email === normalizeEmail(email) && item.purpose === purpose)),
});

/**
 * 인증 코드 발송. 가입은 이미 있는 이메일이면 막는다.
 * 비밀번호 재설정은 계정 존재 여부를 드러내지 않도록 없는 이메일이어도 성공처럼 끝낸다(코드는 만들지 않는다).
 */
export const requestCode = (db: MockDb, email: string, purpose: MockVerification['purpose'], now = Date.now(), generate = randomCode): MockDb => {
  if (!isValidEmail(email)) throw new DataError('이메일 형식을 확인해 주세요.', 'INVALID');
  const account = accountByEmail(db, email);
  if (purpose === 'SIGNUP' && account) throw new DataError('이미 가입된 이메일이에요. 로그인해 주세요.', 'CONFLICT');
  if (purpose === 'RESET' && (!account || !db.credentials[account.id])) return db;
  const next = withoutVerification(db, email, purpose);
  const verification: MockVerification = { email: normalizeEmail(email), purpose, code: generate(), expiresAt: new Date(now + CODE_TTL_MS).toISOString(), verified: false };
  return { ...next, verifications: [...next.verifications, verification] };
};

export const verifyCode = (db: MockDb, email: string, purpose: MockVerification['purpose'], code: string, now = Date.now()): MockDb => {
  if (!CODE_PATTERN.test(code)) throw new DataError('인증 코드는 숫자 6자리예요.', 'INVALID');
  const verification = latestVerification(db, email, purpose);
  if (!verification) throw new DataError('인증 코드를 다시 받아 주세요.', 'INVALID');
  if (new Date(verification.expiresAt).getTime() <= now) throw new DataError('인증 코드가 만료됐어요. 코드를 다시 받아 주세요.', 'GONE');
  if (verification.code !== code) throw new DataError('인증 코드가 맞지 않아요.', 'INVALID');
  return { ...db, verifications: db.verifications.map((item) => (item === verification ? { ...item, verified: true } : item)) };
};

/** 가입 완료. 이메일 인증을 마친 경우에만 계정을 만들고 바로 로그인한다. */
export const signUp = async (db: MockDb, input: SignUpInput) => {
  const verification = latestVerification(db, input.email, 'SIGNUP');
  if (!verification?.verified) throw new DataError('이메일 인증을 먼저 마쳐 주세요.', 'INVALID');
  if (accountByEmail(db, input.email)) throw new DataError('이미 가입된 이메일이에요. 로그인해 주세요.', 'CONFLICT');
  const nameError = validateName(input.name);
  if (nameError) throw new DataError(nameError, 'INVALID');
  if (!isPasswordValid(input.password, 'signup')) throw new DataError('비밀번호 조건을 모두 채워 주세요.', 'INVALID');
  const agreementError = missingAgreement(input.agreements);
  if (agreementError) throw new DataError(agreementError, 'INVALID');
  const accountId = randomId('u');
  const next = withoutVerification(db, input.email, 'SIGNUP');
  return {
    accountId,
    db: {
      ...next,
      currentAccountId: accountId,
      accounts: [...next.accounts, { id: accountId, name: input.name.trim(), email: normalizeEmail(input.email), profileImageUrl: null }],
      credentials: { ...next.credentials, [accountId]: { passwordHash: await hashPassword(input.password) } },
      policyConsents: { ...next.policyConsents, [accountId]: { version: POLICY_VERSION, agreedAt: new Date().toISOString() } },
    },
  };
};

/** 소셜 로그인으로 처음 들어온 계정의 동의(17 §6.2). 세 항목이 모두 있어야 기록한다. */
export const agreePolicies = (db: MockDb, accountId: string, agreements: Agreements): MockDb => {
  const error = missingAgreement(agreements);
  if (error) throw new DataError(error, 'INVALID');
  return { ...db, policyConsents: { ...db.policyConsents, [accountId]: { version: POLICY_VERSION, agreedAt: new Date().toISOString() } } };
};

/** 비밀번호 재설정. 성공하면 코드를 지워 같은 코드로 다시 바꿀 수 없게 한다(10 §5.3, AuthServiceImpl TODO 해소). */
export const resetPassword = async (db: MockDb, email: string, code: string, newPassword: string, now = Date.now()) => {
  const verification = latestVerification(db, email, 'RESET');
  if (!verification) throw new DataError('이미 사용했거나 없는 코드예요. 코드를 다시 받아 주세요.', 'INVALID');
  if (new Date(verification.expiresAt).getTime() <= now) throw new DataError('인증 코드가 만료됐어요. 코드를 다시 받아 주세요.', 'GONE');
  if (!verification.verified || verification.code !== code) throw new DataError('인증 코드를 먼저 확인해 주세요.', 'INVALID');
  if (!isPasswordValid(newPassword, 'reset')) throw new DataError('비밀번호 조건을 모두 채워 주세요.', 'INVALID');
  const account = accountByEmail(db, email)!;
  const next = withoutVerification(db, email, 'RESET');
  return { ...next, credentials: { ...next.credentials, [account.id]: { passwordHash: await hashPassword(newPassword) } } };
};

/* ── OAuth(목) ── */

/**
 * OAuth 임시 코드 교환. 목업은 제공자별 시연 계정을 쓴다.
 * 같은 이메일의 이메일 계정이 이미 있으면 자동 병합하지 않고 CONFLICT로 막는다(10-D3).
 */
export const oauthSignIn = (db: MockDb, provider: OAuthProvider, profile: { subject: string; email: string; name: string }) => {
  const linked = db.oauthLinks.find((link) => link.provider === provider && link.subject === profile.subject);
  if (linked) return { db: { ...db, currentAccountId: linked.accountId }, accountId: linked.accountId, created: false };
  if (accountByEmail(db, profile.email)) {
    throw new DataError('이미 이메일로 가입된 계정이 있어요. 이메일로 로그인한 뒤 계정 설정에서 연동해 주세요.', 'CONFLICT');
  }
  const accountId = randomId('u');
  return {
    accountId,
    created: true,
    db: {
      ...db,
      currentAccountId: accountId,
      accounts: [...db.accounts, { id: accountId, name: profile.name, email: normalizeEmail(profile.email), profileImageUrl: null }],
      oauthLinks: [...db.oauthLinks, { provider, subject: profile.subject, accountId }],
    },
  };
};

/* ── 초대와 합류 ── */

/** 초대 코드 확인. 없는 코드는 NOT_FOUND, 만료됐거나 재발급으로 무효가 된 코드는 GONE이다(10 §5.3). */
const activeInvite = (db: MockDb, code: string, now: number): MockInvite => {
  const invite = INVITE_CODE_PATTERN.test(code) ? db.invites.find((item) => item.code === code) : undefined;
  if (!invite) throw new DataError('초대 링크를 찾을 수 없어요. 강사에게 새 링크를 요청해 주세요.', 'NOT_FOUND');
  if (!invite.active || (invite.expiresAt && new Date(invite.expiresAt).getTime() <= now)) {
    throw new DataError('이 초대 링크는 만료됐어요. 강사에게 새 링크를 요청해 주세요.', 'GONE');
  }
  return invite;
};

export const getInvite = (db: MockDb, code: string, viewerId: string | null, now = Date.now()): InviteInfo => {
  const invite = activeInvite(db, code, now);
  const workspace = db.workspaces.find((item) => item.id === invite.workspaceId)!;
  const ownerId = workspace.members.find((member) => member.role === 'OWNER')?.accountId;
  return {
    code: invite.code,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    ownerName: db.accounts.find((account) => account.id === ownerId)?.name ?? '알 수 없음',
    expiresAt: invite.expiresAt,
    requiresPassword: Boolean(workspace.passwordHash),
    alreadyMember: Boolean(viewerId && workspace.members.some((member) => member.accountId === viewerId)),
  };
};

export const joinByInvite = async (db: MockDb, code: string, accountId: string, password?: string, now = Date.now()): Promise<{ db: MockDb; result: JoinResult }> => {
  const invite = activeInvite(db, code, now);
  const workspace = db.workspaces.find((item) => item.id === invite.workspaceId)!;
  if (workspace.members.some((member) => member.accountId === accountId)) return { db, result: { workspaceId: workspace.id, alreadyMember: true } };
  if (db.bans.some((ban) => ban.workspaceId === workspace.id && ban.accountId === accountId)) {
    throw new DataError('이 워크스페이스에 참여할 수 없어요.', 'FORBIDDEN');
  }
  if (workspace.passwordHash) {
    if (!password) throw new DataError('워크스페이스 비밀번호를 입력해 주세요.', 'INVALID');
    if ((await hashPassword(password)) !== workspace.passwordHash) throw new DataError('비밀번호가 맞지 않아요.', 'INVALID');
  }
  if (workspace.capacity && workspace.members.length >= workspace.capacity) {
    throw new DataError('정원이 가득 찼어요. 워크스페이스 관리자에게 문의해 주세요.', 'FORBIDDEN');
  }
  return {
    result: { workspaceId: workspace.id, alreadyMember: false },
    db: {
      ...db,
      workspaces: db.workspaces.map((item) => (item.id === workspace.id ? { ...item, members: [...item.members, { accountId, role: 'MEMBER' }] } : item)),
      invites: db.invites.map((item) => (item === invite ? { ...item, usedCount: item.usedCount + 1 } : item)),
    },
  };
};

/** 워크스페이스 만들기. 만든 사람이 개설자가 되고, 기본 30일짜리 초대 링크를 함께 발급한다(10-D2). */
export const createWorkspace = async (db: MockDb, accountId: string, input: CreateWorkspaceInput, now = Date.now()) => {
  const error = validateWorkspaceName(input.name) ?? validateWorkspacePassword(input.password ?? '');
  if (error) throw new DataError(error, 'INVALID');
  const workspaceId = randomId('ws');
  return {
    workspaceId,
    db: {
      ...db,
      workspaces: [
        ...db.workspaces,
        {
          id: workspaceId,
          name: input.name.trim(),
          passwordHash: input.password ? await hashPassword(input.password) : undefined,
          members: [{ accountId, role: 'OWNER' as const }],
        },
      ],
      invites: [
        ...db.invites,
        { workspaceId, code: randomId('INV').toUpperCase().replace(/[^A-Z0-9-]/g, ''), expiresAt: new Date(now + 30 * 86_400_000).toISOString(), active: true, usedCount: 0 },
      ],
    },
  };
};
