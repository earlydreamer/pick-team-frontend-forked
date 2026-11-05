import { describe, expect, it } from 'vitest';
import { exportMyData, myDataRows } from '@/renewal/domain/account';
import { MOCK_PASSWORD, seed } from './db';
import { signIn, signUp } from './authRules';
import { changePassword, deleteAccount, deleteCard, deletionBlockers, myData, updateName } from './accountRules';

const NEW_PASSWORD = 'Newpass1!';

describe('이름과 비밀번호', () => {
  it('이름은 가입 규칙대로 바꾼다', () => {
    expect(() => updateName(seed(), 'u-03', 'a')).toThrow('2~50자');
    expect(updateName(seed(), 'u-03', ' 박민준2 ').accounts.find((account) => account.id === 'u-03')?.name).toBe('박민준2');
  });

  it('지금 비밀번호가 맞아야 하고, 새 비밀번호로 로그인한다', async () => {
    await expect(changePassword(seed(), 'u-03', 'wrong', NEW_PASSWORD)).rejects.toThrow('지금 비밀번호가 맞지 않아요');
    await expect(changePassword(seed(), 'u-03', MOCK_PASSWORD, 'short')).rejects.toThrow('조건에 맞지 않아요');
    await expect(changePassword(seed(), 'u-03', MOCK_PASSWORD, MOCK_PASSWORD)).rejects.toThrow('달라야 해요');
    const db = await changePassword(seed(), 'u-03', MOCK_PASSWORD, NEW_PASSWORD);
    const email = db.accounts.find((account) => account.id === 'u-03')!.email;
    await expect(signIn(db, email, MOCK_PASSWORD)).rejects.toThrow();
    expect((await signIn(db, email, NEW_PASSWORD)).accountId).toBe('u-03');
  });
});

describe('카드 삭제', () => {
  it('동의 기록과 카드 내용을 지운다', () => {
    const card = deleteCard(seed(), 'u-01').cards['u-01'];
    expect(card.consentGivenAt).toBeUndefined();
    expect(card.desiredRole1).toBeUndefined();
    expect(card.cardVisible).toBe(false);
  });
});

describe('계정 삭제', () => {
  it('개설자와 팀원이 있는 팀장은 먼저 넘기거나 위임해야 한다', () => {
    expect(deletionBlockers(seed(), 'u-instructor')).toHaveLength(2);
    expect(deletionBlockers(seed(), 'u-01')[0]).toContain('알파팀 팀장을 위임');
    expect(deletionBlockers(seed(), 'u-02')).toEqual([]);
  });

  it('비밀번호를 확인하고 워크스페이스·로그인 수단·카드를 지운다', async () => {
    await expect(deleteAccount(seed(), 'u-02', 'wrong')).rejects.toThrow('비밀번호가 맞지 않아요');
    await expect(deleteAccount(seed(), 'u-01', MOCK_PASSWORD)).rejects.toThrow('팀장을 위임');
    const email = seed().accounts.find((account) => account.id === 'u-02')!.email;
    const db = await deleteAccount(seed(), 'u-02', MOCK_PASSWORD);
    expect(db.currentAccountId).toBeNull();
    expect(db.workspaces.some((workspace) => workspace.members.some((member) => member.accountId === 'u-02'))).toBe(false);
    expect(db.teams.find((team) => team.id === 't-1')?.memberIds).not.toContain('u-02');
    expect(db.credentials['u-02']).toBeUndefined();
    expect(db.cards['u-02']).toBeUndefined();
    await expect(signIn(db, email, MOCK_PASSWORD)).rejects.toThrow('맞지 않아요');
  });

  it('지운 이메일로 다시 가입할 수 있다', async () => {
    const email = seed().accounts.find((account) => account.id === 'u-02')!.email;
    const db = await deleteAccount(seed(), 'u-02', MOCK_PASSWORD);
    const verified = { ...db, verifications: [{ email, purpose: 'SIGNUP' as const, code: '123456', expiresAt: new Date(Date.now() + 60_000).toISOString(), verified: true }] };
    const result = await signUp(verified, { email, password: NEW_PASSWORD, name: '이영희' });
    expect(result.accountId).not.toBe('u-02');
  });
});

describe('내 데이터', () => {
  it('17 §6.1 항목을 공개 범위와 함께 보여 주고 내려받기에 담는다', () => {
    const data = myData(seed(), 'u-01');
    const rows = myDataRows(data);
    expect(rows.find((row) => row.label === '이메일')?.scope).toBe('나만(로그인용)');
    expect(rows.find((row) => row.label === '희망 역할')?.value).not.toBe('없음');
    expect(rows.find((row) => row.label === '소속 워크스페이스')?.value).toContain('2026 하계 부트캠프(멤버)');
    expect(data.workspaces.find((workspace) => workspace.id === 'ws-1')).toMatchObject({ teamName: '알파팀', teamLeader: true });
    const file = exportMyData(data, new Date('2026-11-05T00:00:00Z'));
    expect(file).toMatchObject({ exportedAt: '2026-11-05T00:00:00.000Z', loginMethods: ['EMAIL'] });
    expect(JSON.stringify(file)).not.toContain('passwordHash');
  });
});
