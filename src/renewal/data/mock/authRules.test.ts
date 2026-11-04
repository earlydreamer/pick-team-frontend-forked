import { describe, expect, it } from 'vitest';
import { MOCK_PASSWORD, seed, type MockDb } from './db';
import { DataError } from '../ports';
import { createWorkspace, getInvite, joinByInvite, oauthSignIn, requestCode, resetPassword, signIn, signUp, verifyCode } from './authRules';

const codeOf = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (error) {
    return error instanceof DataError ? error.code : 'OTHER';
  }
  return 'NONE';
};
const fixed = () => '123456';
const NEW_EMAIL = 'new@example.com';
const STUDENT_EMAIL = 'user1@example.com';

describe('로그인', () => {
  it('맞는 비밀번호면 로그인 상태가 된다', async () => {
    const result = await signIn({ ...seed(), currentAccountId: null }, STUDENT_EMAIL, MOCK_PASSWORD);
    expect(result.db.currentAccountId).toBe('u-student');
  });

  it('없는 이메일과 틀린 비밀번호를 같은 오류로 알린다', async () => {
    const wrongPassword = await signIn(seed(), STUDENT_EMAIL, 'nope').catch((error: DataError) => error.message);
    const unknownEmail = await signIn(seed(), 'none@example.com', MOCK_PASSWORD).catch((error: DataError) => error.message);
    expect(wrongPassword).toBe(unknownEmail);
  });
});

describe('가입', () => {
  it('이미 가입된 이메일은 코드를 보내지 않는다', async () => {
    expect(await codeOf(() => requestCode(seed(), STUDENT_EMAIL, 'SIGNUP'))).toBe('CONFLICT');
  });

  it('코드 확인 후 가입하면 계정이 생기고 로그인된다', async () => {
    let db = requestCode(seed(), NEW_EMAIL, 'SIGNUP', Date.now(), fixed);
    db = verifyCode(db, NEW_EMAIL, 'SIGNUP', '123456');
    const result = await signUp(db, { email: NEW_EMAIL, name: '새 수강생', password: 'Pickteam1!' });
    expect(result.db.currentAccountId).toBe(result.accountId);
    expect(result.db.verifications).toHaveLength(0);
    expect((await signIn(result.db, NEW_EMAIL, 'Pickteam1!')).accountId).toBe(result.accountId);
  });

  it('코드를 확인하지 않으면 가입할 수 없다', async () => {
    const db = requestCode(seed(), NEW_EMAIL, 'SIGNUP', Date.now(), fixed);
    expect(await codeOf(() => signUp(db, { email: NEW_EMAIL, name: '새 수강생', password: 'Pickteam1!' }))).toBe('INVALID');
  });

  it('5분이 지난 코드는 GONE, 틀린 코드는 INVALID다', async () => {
    const issued = Date.now();
    const db = requestCode(seed(), NEW_EMAIL, 'SIGNUP', issued, fixed);
    expect(await codeOf(() => verifyCode(db, NEW_EMAIL, 'SIGNUP', '123456', issued + 5 * 60 * 1000 + 1))).toBe('GONE');
    expect(await codeOf(() => verifyCode(db, NEW_EMAIL, 'SIGNUP', '654321', issued))).toBe('INVALID');
  });
});

describe('비밀번호 재설정', () => {
  it('없는 이메일이어도 성공처럼 끝나 계정 존재를 드러내지 않는다', () => {
    const db = requestCode(seed(), 'none@example.com', 'RESET');
    expect(db.verifications).toHaveLength(0);
  });

  it('재설정에 쓴 코드는 다시 쓸 수 없다', async () => {
    let db = requestCode(seed(), STUDENT_EMAIL, 'RESET', Date.now(), fixed);
    db = verifyCode(db, STUDENT_EMAIL, 'RESET', '123456');
    const changed = await resetPassword(db, STUDENT_EMAIL, '123456', 'newpass1!');
    expect((await signIn(changed, STUDENT_EMAIL, 'newpass1!')).accountId).toBe('u-student');
    expect(await codeOf(() => resetPassword(changed, STUDENT_EMAIL, '123456', 'another1!'))).toBe('INVALID');
  });
});

describe('OAuth', () => {
  it('같은 이메일의 이메일 계정이 있으면 병합하지 않고 막는다(10-D3)', async () => {
    expect(await codeOf(() => oauthSignIn(seed(), 'google', { subject: 'g-1', email: STUDENT_EMAIL, name: '김수강' }))).toBe('CONFLICT');
  });

  it('처음이면 계정을 만들고, 다시 오면 같은 계정으로 로그인한다', () => {
    const first = oauthSignIn(seed(), 'kakao', { subject: 'k-1', email: 'kakao@example.com', name: '카카오 사용자' });
    const second = oauthSignIn({ ...first.db, currentAccountId: null }, 'kakao', { subject: 'k-1', email: 'kakao@example.com', name: '카카오 사용자' });
    expect(first.created).toBe(true);
    expect(second).toMatchObject({ accountId: first.accountId, created: false });
  });
});

describe('초대와 합류', () => {
  it('없는 코드는 NOT_FOUND, 만료·재발급된 코드는 GONE이다', async () => {
    expect(await codeOf(() => getInvite(seed(), 'NOPE', null))).toBe('NOT_FOUND');
    expect(await codeOf(() => getInvite(seed(), 'SPRING26', null))).toBe('GONE');
    expect(await codeOf(() => getInvite(seed(), 'UXOLD', null))).toBe('GONE');
  });

  it('초대 정보에 워크스페이스 이름, 개설자, 비밀번호 필요 여부, 멤버 여부를 담는다', () => {
    expect(getInvite(seed(), 'UXSTUDY', 'u-student')).toMatchObject({ workspaceName: 'UX 리서치 스터디', ownerName: '박강사', requiresPassword: true, alreadyMember: false });
    expect(getInvite(seed(), 'SUMMER26', 'u-student').alreadyMember).toBe(true);
  });

  it('이미 멤버면 합류하지 않고 알려 준다', async () => {
    const { result } = await joinByInvite(seed(), 'SUMMER26', 'u-student');
    expect(result).toEqual({ workspaceId: 'ws-1', alreadyMember: true });
  });

  it('비밀번호가 있는 워크스페이스는 비밀번호가 맞아야 합류한다', async () => {
    expect(await codeOf(() => joinByInvite(seed(), 'UXSTUDY', 'u-student'))).toBe('INVALID');
    expect(await codeOf(() => joinByInvite(seed(), 'UXSTUDY', 'u-student', 'wrong'))).toBe('INVALID');
    const { db, result } = await joinByInvite(seed(), 'UXSTUDY', 'u-student', 'study');
    expect(result.alreadyMember).toBe(false);
    expect(db.workspaces.find((ws) => ws.id === 'ws-3')?.members.some((m) => m.accountId === 'u-student' && m.role === 'MEMBER')).toBe(true);
    expect(db.invites.find((invite) => invite.code === 'UXSTUDY')?.usedCount).toBe(2);
  });

  it('차단된 멤버와 정원이 찬 워크스페이스는 FORBIDDEN이다', async () => {
    const outsider: MockDb = { ...seed(), workspaces: seed().workspaces.map((ws) => (ws.id === 'ws-1' ? { ...ws, members: ws.members.filter((m) => m.accountId !== 'u-11') } : ws)) };
    expect(await codeOf(() => joinByInvite(seed(), 'SUMMER26', 'u-12'))).toBe('FORBIDDEN');
    const full: MockDb = { ...outsider, workspaces: outsider.workspaces.map((ws) => (ws.id === 'ws-1' ? { ...ws, capacity: ws.members.length } : ws)) };
    expect(await codeOf(() => joinByInvite(full, 'SUMMER26', 'u-11'))).toBe('FORBIDDEN');
  });

  it('워크스페이스를 만들면 개설자가 되고 30일짜리 초대 링크가 생긴다', async () => {
    const now = Date.now();
    const { db, workspaceId } = await createWorkspace(seed(), 'u-03', { name: '새 스터디' }, now);
    expect(db.workspaces.find((ws) => ws.id === workspaceId)?.members).toEqual([{ accountId: 'u-03', role: 'OWNER' }]);
    const invite = db.invites.find((item) => item.workspaceId === workspaceId)!;
    expect(new Date(invite.expiresAt!).getTime() - now).toBe(30 * 86_400_000);
    expect(getInvite(db, invite.code, null).workspaceName).toBe('새 스터디');
  });
});
