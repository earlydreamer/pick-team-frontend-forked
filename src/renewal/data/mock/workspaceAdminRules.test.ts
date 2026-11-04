import { describe, expect, it } from 'vitest';
import { memberActions, tabsFor } from '@/renewal/domain/workspaceAdmin';
import { seed, type MockDb } from './db';
import { joinByInvite } from './authRules';
import {
  banMember,
  changeRole,
  currentInvite,
  deleteWorkspace,
  kickMember,
  leaveWorkspace,
  refreshInvite,
  renameWorkspace,
  setWorkspacePassword,
  transferOwnership,
  unbanMember,
} from './workspaceAdminRules';

const WS = 'ws-1';
const roleIn = (db: MockDb, accountId: string) => db.workspaces.find((item) => item.id === WS)?.members.find((member) => member.accountId === accountId)?.role;
const team = (db: MockDb, id: string) => db.teams.find((item) => item.id === id);

describe('권한 표', () => {
  it('멤버는 일반 탭만, 매니저는 보안·위험 구역을 빼고 연다', () => {
    expect(tabsFor('MEMBER').map((tab) => tab.id)).toEqual(['general']);
    expect(tabsFor('ADMIN').map((tab) => tab.id)).toEqual(['general', 'invite', 'members', 'bans']);
    expect(tabsFor('OWNER')).toHaveLength(6);
  });

  it('매니저는 멤버만 내보내고, 자기 자신과 개설자에게는 아무것도 못 한다', () => {
    expect(memberActions('ADMIN', 'a', { accountId: 'm', role: 'MEMBER' })).toMatchObject({ kick: true, ban: true, promote: false, transfer: false });
    expect(memberActions('ADMIN', 'a', { accountId: 'b', role: 'ADMIN' }).kick).toBe(false);
    expect(Object.values(memberActions('OWNER', 'o', { accountId: 'o', role: 'OWNER' })).some(Boolean)).toBe(false);
    expect(memberActions('OWNER', 'o', { accountId: 'b', role: 'ADMIN' })).toMatchObject({ demote: true, promote: false, kick: true });
  });
});

describe('일반·초대·보안', () => {
  it('이름은 매니저 이상만 바꾸고 빈 이름은 막는다', () => {
    expect(() => renameWorkspace(seed(), WS, 'u-01', '새 이름')).toThrow('개설자와 매니저만');
    expect(() => renameWorkspace(seed(), WS, 'u-manager', '  ')).toThrow('이름을 입력');
    expect(renameWorkspace(seed(), WS, 'u-manager', ' 가을 부트캠프 ').workspaces[0].name).toBe('가을 부트캠프');
  });

  it('현재 링크는 유효한 링크를 먼저 고른다', () => {
    expect(currentInvite(seed(), WS)?.code).toBe('SUMMER26');
  });

  it('재발급하면 이전 링크는 바로 만료되고 새 링크로 합류한다', async () => {
    const at = Date.UTC(2026, 10, 4);
    const db = refreshInvite(seed(), WS, 'u-instructor', null, at, () => 'NEWCODE');
    expect(currentInvite(db, WS)).toMatchObject({ code: 'NEWCODE', expiresAt: null, usedCount: 0 });
    await expect(joinByInvite(db, 'SUMMER26', 'u-new')).rejects.toThrow('만료');
    expect(refreshInvite(seed(), WS, 'u-instructor', 7, at, () => 'C7').invites.slice(-1)[0]?.expiresAt).toBe(new Date(at + 7 * 86_400_000).toISOString());
    expect(() => refreshInvite(seed(), WS, 'u-01', 30)).toThrow('개설자와 매니저만');
  });

  it('비밀번호는 개설자만 정하고 지울 수 있다', async () => {
    await expect(setWorkspacePassword(seed(), WS, 'u-manager', 'abcd')).rejects.toThrow('개설자만');
    await expect(setWorkspacePassword(seed(), WS, 'u-instructor', 'ab')).rejects.toThrow('4~100자');
    const locked = await setWorkspacePassword(seed(), WS, 'u-instructor', 'abcd');
    expect(locked.workspaces[0].passwordHash).toBeTruthy();
    expect((await setWorkspacePassword(locked, WS, 'u-instructor', null)).workspaces[0].passwordHash).toBeUndefined();
  });
});

describe('역할', () => {
  it('개설자만 매니저를 임명·해제한다', () => {
    expect(roleIn(changeRole(seed(), WS, 'u-instructor', 'u-01', 'ADMIN'), 'u-01')).toBe('ADMIN');
    expect(roleIn(changeRole(seed(), WS, 'u-instructor', 'u-manager', 'MEMBER'), 'u-manager')).toBe('MEMBER');
    expect(() => changeRole(seed(), WS, 'u-manager', 'u-01', 'ADMIN')).toThrow('할 수 없는 일');
  });

  it('개설자를 넘기면 받는 사람이 개설자, 넘긴 사람은 매니저가 된다', () => {
    expect(() => transferOwnership(seed(), WS, 'u-instructor', 'u-manager', '틀린 이름')).toThrow('이름이 맞지 않아요');
    const name = seed().accounts.find((account) => account.id === 'u-manager')!.name;
    const db = transferOwnership(seed(), WS, 'u-instructor', 'u-manager', name);
    expect([roleIn(db, 'u-manager'), roleIn(db, 'u-instructor')]).toEqual(['OWNER', 'ADMIN']);
  });
});

describe('내보내기·차단·나가기', () => {
  it('팀원을 내보내면 팀과 담당, 대기 지원이 정리된다', () => {
    const { db } = kickMember(seed(), WS, 'u-manager', 'u-02');
    expect(roleIn(db, 'u-02')).toBeUndefined();
    expect(team(db, 't-1')?.memberIds).not.toContain('u-02');
    expect(db.tasks.some((task) => task.assigneeIds.includes('u-02'))).toBe(false);
    const app = kickMember(seed(), WS, 'u-manager', 'u-03').db.applications.find((item) => item.id === 'app-3');
    expect(app).toMatchObject({ status: 'EXPIRED', reason: '워크스페이스에서 제외됨' });
  });

  it('팀장을 내보내면 가장 먼저 합류한 팀원이 팀장을 잇는다', () => {
    const result = kickMember(seed(), WS, 'u-instructor', 'u-01');
    expect(result.successor).toEqual({ teamId: 't-1', accountId: 'u-02' });
    expect(team(result.db, 't-1')?.leaderId).toBe('u-02');
  });

  it('차단하면 다시 합류할 수 없고, 해제하면 합류할 수 있다', async () => {
    const { db } = banMember(seed(), WS, 'u-manager', 'u-03');
    await expect(joinByInvite(db, 'SUMMER26', 'u-03')).rejects.toThrow('참여할 수 없어요');
    const lifted = unbanMember(db, WS, 'u-manager', 'u-03');
    expect((await joinByInvite(lifted, 'SUMMER26', 'u-03')).result.alreadyMember).toBe(false);
  });

  it('매니저는 다른 매니저를 내보내지 못한다', () => {
    const db = changeRole(seed(), WS, 'u-instructor', 'u-01', 'ADMIN');
    expect(() => kickMember(db, WS, 'u-manager', 'u-01')).toThrow('할 수 없는 일');
  });

  it('팀장은 위임 전에 나갈 수 없고, 개설자는 넘긴 뒤에 나간다', () => {
    expect(() => leaveWorkspace(seed(), WS, 'u-01')).toThrow('팀장을 위임한 뒤');
    expect(() => leaveWorkspace(seed(), WS, 'u-instructor')).toThrow('넘긴 뒤에');
    expect(roleIn(leaveWorkspace(seed(), WS, 'u-03'), 'u-03')).toBeUndefined();
  });
});

describe('삭제', () => {
  it('이름이 맞아야 지우고, 팀과 채팅·초대 링크를 함께 지운다', () => {
    expect(() => deleteWorkspace(seed(), WS, 'u-instructor', '아무 이름')).toThrow('이름이 맞지 않아요');
    expect(() => deleteWorkspace(seed(), WS, 'u-manager', '2026 하계 부트캠프')).toThrow('개설자만');
    const db = deleteWorkspace(seed(), WS, 'u-instructor', '2026 하계 부트캠프');
    expect(db.workspaces.some((item) => item.id === WS)).toBe(false);
    expect(db.teams.some((item) => item.workspaceId === WS)).toBe(false);
    expect(db.chatRooms.some((room) => room.workspaceId === WS)).toBe(false);
    expect(db.invites.some((invite) => invite.workspaceId === WS)).toBe(false);
    expect(db.workspaces).toHaveLength(seed().workspaces.length - 1);
  });
});
