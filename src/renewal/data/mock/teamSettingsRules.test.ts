import { describe, expect, it } from 'vitest';
import { seed, type MockDb } from './db';
import { DataError } from '../ports';
import { cancelDelegation, deleteTeam, leaveTeam, removeMember, requestDelegation, respondDelegation, updateTeamInfo } from './teamSettingsRules';
import { transition } from './kanbanRules';

const WS = 'ws-1';
const T1 = 't-1';
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof DataError ? error.code : 'OTHER';
  }
  return 'NONE';
};
const team = (db: MockDb, id = T1) => db.teams.find((item) => item.id === id);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

describe('기본 정보', () => {
  it('팀장만 이름과 소개를 바꾸고, 같은 이름은 막는다', () => {
    expect(team(updateTeamInfo(seed(), WS, T1, 'u-01', { name: '알파', intro: '새 소개' }))).toMatchObject({ name: '알파', intro: '새 소개' });
    expect(codeOf(() => updateTeamInfo(seed(), WS, T1, 'u-02', { name: '알파' }))).toBe('FORBIDDEN');
    expect(codeOf(() => updateTeamInfo(seed(), WS, T1, 'u-01', { name: '달빛' }))).toBe('CONFLICT');
  });
});

describe('팀장 위임', () => {
  it('지명 → 수락하면 팀장이 바뀐다', () => {
    let db = requestDelegation(seed(), WS, T1, 'u-01', 'u-02');
    expect(codeOf(() => requestDelegation(db, WS, T1, 'u-01', 'u-02'))).toBe('CONFLICT');
    db = respondDelegation(db, WS, T1, 'u-02', true);
    expect(team(db)).toMatchObject({ leaderId: 'u-02', delegation: undefined });
  });

  it('거절하거나 취소하면 요청이 사라지고 팀장은 그대로다', () => {
    const requested = requestDelegation(seed(), WS, T1, 'u-01', 'u-02');
    expect(team(respondDelegation(requested, WS, T1, 'u-02', false))).toMatchObject({ leaderId: 'u-01', delegation: undefined });
    expect(team(cancelDelegation(requested, WS, T1, 'u-01'))?.delegation).toBeUndefined();
  });

  it('24시간이 지난 요청은 수락할 수 없다', () => {
    const db: MockDb = { ...seed(), teams: seed().teams.map((item) => (item.id === T1 ? { ...item, delegation: { targetId: 'u-02', requestedAt: hoursAgo(25) } } : item)) };
    expect(codeOf(() => respondDelegation(db, WS, T1, 'u-02', true))).toBe('GONE');
    expect(codeOf(() => requestDelegation(db, WS, T1, 'u-01', 'u-02'))).toBe('NONE');
  });

  it('위임이 진행 중이면 팀장 승인을 보류하고, 매니저 개입 승인은 받는다(14 §5.2)', () => {
    const db = requestDelegation(seed(), WS, T1, 'u-01', 'u-02');
    expect(codeOf(() => transition(db, WS, T1, 'u-01', 'k-4', 'approve'))).toBe('CONFLICT');
    expect(codeOf(() => transition(db, WS, T1, 'u-instructor', 'k-4', 'approve'))).toBe('NONE');
  });
});

describe('멤버 관리', () => {
  it('팀장과 매니저는 팀원을 내보내고, 담당 태스크에서도 뺀다', () => {
    const db = removeMember(seed(), WS, T1, 'u-instructor', 'u-02');
    expect(team(db)?.memberIds).toEqual(['u-01']);
    expect(db.workspaces[0].members.find((member) => member.accountId === 'u-02')?.teamId).toBeUndefined();
    expect(db.tasks.filter((task) => task.teamId === T1).every((task) => !task.assigneeIds.includes('u-02'))).toBe(true);
    expect(codeOf(() => removeMember(seed(), WS, T1, 'u-02', 'u-01'))).toBe('FORBIDDEN');
    expect(codeOf(() => removeMember(seed(), WS, T1, 'u-01', 'u-01'))).toBe('CONFLICT');
  });

  it('팀원은 나가고, 팀장은 위임 전에는 나가지 못한다', () => {
    expect(team(leaveTeam(seed(), WS, T1, 'u-02').db)?.memberIds).toEqual(['u-01']);
    expect(codeOf(() => leaveTeam(seed(), WS, T1, 'u-01'))).toBe('CONFLICT');
    const waiting = requestDelegation(seed(), WS, T1, 'u-01', 'u-02');
    expect(() => leaveTeam(waiting, WS, T1, 'u-01')).toThrow('위임 수락을 기다리는 중이에요');
  });

  it('혼자 남은 팀장이 나가면 팀을 해체한다', () => {
    const alone = leaveTeam(seed(), WS, T1, 'u-02').db;
    const result = leaveTeam(alone, WS, T1, 'u-01');
    expect(result.disbanded).toBe(true);
    expect(team(result.db)).toBeUndefined();
  });
});

describe('팀 삭제', () => {
  it('팀 이름이 맞아야 지우고, 팀 데이터와 모집 중 대기 제안을 정리한다', () => {
    expect(codeOf(() => deleteTeam(seed(), WS, T1, 'u-01', '알파'))).toBe('INVALID');
    const db = deleteTeam(seed(), WS, T1, 'u-01', '알파팀');
    expect(team(db)).toBeUndefined();
    expect(db.tasks.some((task) => task.teamId === T1)).toBe(false);
    expect(db.posts.some((post) => post.teamId === T1)).toBe(false);
    expect(db.workspaces[0].members.find((member) => member.accountId === 'u-01')?.teamId).toBeUndefined();
    expect(db.applications.find((app) => app.id === 'app-3')).toMatchObject({ status: 'EXPIRED', reason: '팀 해체' });
  });

  it('팀원은 팀을 지우지 못한다', () => {
    expect(codeOf(() => deleteTeam(seed(), WS, T1, 'u-02', '알파팀'))).toBe('FORBIDDEN');
  });
});
