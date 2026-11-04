import { describe, expect, it } from 'vitest';
import { seed, type MockDb } from './db';
import { DataError } from '../ports';
import { addTeamSlot, assignMember, closeSession, createSession, openSession, participantsOf, randomAssign, resolveSession, unassignMember, updateSession } from './sessionRules';

const WS = 'ws-1';
const MANAGER = 'u-instructor';
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof DataError ? error.code : 'OTHER';
  }
  return 'NONE';
};
const closing = (): MockDb => closeSession(seed(), WS, MANAGER);
const unassigned = (db: MockDb) => participantsOf(db, WS).filter((member) => !member.teamId).map((member) => member.accountId);
const teamOf = (db: MockDb, accountId: string) => db.workspaces[0].members.find((member) => member.accountId === accountId)?.teamId;

describe('세션 권한과 생성', () => {
  it('멤버는 세션을 바꿀 수 없다', () => {
    expect(codeOf(() => closeSession(seed(), WS, 'u-student'))).toBe('FORBIDDEN');
  });

  it('세션이 없을 때만 DRAFT로 만든다', () => {
    const empty = { ...seed(), sessions: [] };
    const db = createSession(empty, WS, MANAGER, { closesAt: inDays(5), teamCapacity: 4 });
    expect(db.sessions[0].status).toBe('DRAFT');
    expect(codeOf(() => createSession(db, WS, MANAGER, { closesAt: inDays(5), teamCapacity: 4 }))).toBe('CONFLICT');
  });

  it('지난 마감이나 범위 밖 정원은 INVALID로 막는다', () => {
    const empty = { ...seed(), sessions: [] };
    expect(codeOf(() => createSession(empty, WS, MANAGER, { closesAt: inDays(-1), teamCapacity: 4 }))).toBe('INVALID');
    expect(codeOf(() => createSession(empty, WS, MANAGER, { closesAt: inDays(3), teamCapacity: 1 }))).toBe('INVALID');
  });

  it('DRAFT에서 모집을 시작하면 OPEN이 된다', () => {
    const draft = createSession({ ...seed(), sessions: [] }, WS, MANAGER, { closesAt: inDays(5), teamCapacity: 4 });
    expect(openSession(draft, WS, MANAGER).sessions[0].status).toBe('OPEN');
  });
});

describe('모집 중 운영', () => {
  it('OPEN에서는 마감 연장만 되고 정원은 바꿀 수 없다', () => {
    const db = seed();
    const later = new Date(new Date(db.sessions[0].closesAt).getTime() + 86_400_000).toISOString();
    expect(updateSession(db, WS, MANAGER, { closesAt: later, teamCapacity: 4 }).sessions[0].closesAt).toBe(later);
    expect(codeOf(() => updateSession(db, WS, MANAGER, { closesAt: later, teamCapacity: 5 }))).toBe('CONFLICT');
    expect(codeOf(() => updateSession(db, WS, MANAGER, { closesAt: inDays(1), teamCapacity: 4 }))).toBe('INVALID');
  });

  it('지금 마감하면 CLOSING이 되고 대기 제안은 모집 마감으로 만료한다', () => {
    const db = closing();
    expect(db.sessions[0].status).toBe('CLOSING');
    const pending = db.applications.filter((app) => app.status === 'PENDING');
    expect(pending).toHaveLength(0);
    expect(db.applications.find((app) => app.id === 'app-3')).toMatchObject({ status: 'EXPIRED', reason: '모집 마감' });
  });
});

describe('마감 처리', () => {
  it('수동 배치는 CLOSING에서만 되고 팀 목록과 멤버 소속을 함께 바꾼다', () => {
    expect(codeOf(() => assignMember(seed(), WS, MANAGER, 'u-03', 't-1'))).toBe('CONFLICT');
    const db = assignMember(closing(), WS, MANAGER, 'u-03', 't-1');
    expect(db.teams.find((team) => team.id === 't-1')?.memberIds).toContain('u-03');
    expect(teamOf(db, 'u-03')).toBe('t-1');
  });

  it('정원이 찬 팀에는 배치할 수 없다', () => {
    let db = assignMember(closing(), WS, MANAGER, 'u-03', 't-1');
    db = assignMember(db, WS, MANAGER, 'u-07', 't-1');
    expect(codeOf(() => assignMember(db, WS, MANAGER, 'u-09', 't-1'))).toBe('CONFLICT');
  });

  it('팀장을 빼면 남은 팀원이 팀장을 이어받는다', () => {
    const db = unassignMember(closing(), WS, MANAGER, 'u-01');
    expect(db.teams.find((team) => team.id === 't-1')).toMatchObject({ leaderId: 'u-02', memberIds: ['u-02'] });
    expect(teamOf(db, 'u-01')).toBeUndefined();
  });

  it('빈 팀 슬롯에 처음 배치한 사람이 팀장이 된다', () => {
    const slot = addTeamSlot(closing(), WS, MANAGER, '새벽');
    const db = assignMember(slot.db, WS, MANAGER, 'u-10', slot.teamId);
    expect(db.teams.find((team) => team.id === slot.teamId)?.leaderId).toBe('u-10');
  });

  it('랜덤 배치는 빈자리만큼 배치하고 남은 인원을 알려 준다', () => {
    // 미배정 6명(u-student, u-03, u-07, u-09, u-10, u-11), 빈자리 6석(팀 3개 × 2)
    const result = randomAssign(closing(), WS, MANAGER, () => 0.5);
    expect(result).toMatchObject({ assigned: 6, remaining: 0 });
    expect(unassigned(result.db)).toHaveLength(0);
    // 정원 3명이면 팀마다 1석씩 3석뿐이라 3명이 남는다.
    const tight = closing();
    const short = randomAssign({ ...tight, sessions: tight.sessions.map((session) => ({ ...session, teamCapacity: 3 })) }, WS, MANAGER, () => 0.5);
    expect(short).toMatchObject({ assigned: 3, remaining: 3 });
  });

  it('랜덤 배치는 같은 역할이 적은 팀을 고른다', () => {
    // u-03은 백엔드 희망. 알파팀(u-01)에는 백엔드가 있고 나머지 팀에는 없다.
    let db = closing();
    for (const id of ['u-student', 'u-07', 'u-09', 'u-10', 'u-11']) db = { ...db, workspaces: db.workspaces.map((ws) => ({ ...ws, members: ws.members.filter((m) => m.accountId !== id) })) };
    const result = randomAssign(db, WS, MANAGER, () => 0.5);
    expect(teamOf(result.db, 'u-03')).not.toBe('t-1');
  });

  it('미배정자가 남으면 확정할 수 없고, 0명이면 RESOLVED가 되며 빈 슬롯을 정리한다', () => {
    expect(codeOf(() => resolveSession(closing(), WS, MANAGER))).toBe('CONFLICT');
    const slot = addTeamSlot(closing(), WS, MANAGER, '빈 슬롯');
    const filled = randomAssign(slot.db, WS, MANAGER, () => 0.5).db;
    const emptySlotKept = filled.teams.some((team) => team.id === slot.teamId && team.memberIds.length === 0);
    const resolved = resolveSession(filled, WS, MANAGER);
    expect(resolved.sessions[0].status).toBe('RESOLVED');
    if (emptySlotKept) expect(resolved.teams.some((team) => team.id === slot.teamId)).toBe(false);
    expect(codeOf(() => assignMember(resolved, WS, MANAGER, 'u-03', 't-1'))).toBe('CONFLICT');
  });
});
