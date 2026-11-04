import { describe, expect, it } from 'vitest';
import { seed, type MockDb } from './db';
import { accept, apply, createTeam, decline, scout, withdraw } from './rules';
import { DataError } from '../ports';

const WS = 'ws-1';
const publish = (db: MockDb, id: string): MockDb => ({ ...db, cards: { ...db.cards, [id]: { ...db.cards['u-01'] } } });
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof DataError ? error.code : 'OTHER';
  }
  return 'NONE';
};
const memberTeam = (db: MockDb, id: string) => db.workspaces[0].members.find((member) => member.accountId === id)?.teamId;

describe('지원', () => {
  it('공개 카드가 없으면 CARD_REQUIRED로 막는다(01-D1)', () => {
    expect(codeOf(() => apply(seed(), WS, 'u-student', 't-1'))).toBe('CARD_REQUIRED');
  });

  it('개설자와 매니저는 당사자가 될 수 없다', () => {
    expect(codeOf(() => apply(publish(seed(), 'u-instructor'), WS, 'u-instructor', 't-1'))).toBe('FORBIDDEN');
  });

  it('같은 팀에 중복 지원할 수 없다', () => {
    const db = apply(publish(seed(), 'u-student'), WS, 'u-student', 't-1');
    expect(codeOf(() => apply(db, WS, 'u-student', 't-1'))).toBe('CONFLICT');
  });

  it('답변 대기 지원은 3건까지다(12-D4)', () => {
    let db = publish(seed(), 'u-student');
    db = { ...db, teams: [...db.teams, { ...db.teams[0], id: 't-x', name: '추가팀', leaderId: 'u-10', memberIds: ['u-10'] }] };
    db = apply(apply(apply(db, WS, 'u-student', 't-1'), WS, 'u-student', 't-2'), WS, 'u-student', 't-3');
    expect(codeOf(() => apply(db, WS, 'u-student', 't-x'))).toBe('CONFLICT');
  });

  it('모집 기간(OPEN)이 아니면 막는다', () => {
    const db = publish(seed(), 'u-student');
    const closing = { ...db, sessions: db.sessions.map((session) => ({ ...session, status: 'CLOSING' as const })) };
    expect(codeOf(() => apply(closing, WS, 'u-student', 't-1'))).toBe('CONFLICT');
  });
});

describe('스카우트', () => {
  it('팀장만 보낼 수 있다(12-D1)', () => {
    expect(codeOf(() => scout(seed(), WS, 'u-02', 'u-03'))).toBe('FORBIDDEN');
    expect(codeOf(() => scout(seed(), WS, 'u-01', 'u-03'))).toBe('NONE');
  });

  it('이미 팀이 있는 멤버에게는 보낼 수 없다', () => {
    expect(codeOf(() => scout(seed(), WS, 'u-01', 'u-05'))).toBe('CONFLICT');
  });
});

describe('수락과 연쇄 정리', () => {
  it('지원은 팀장만 수락할 수 있다', () => {
    expect(codeOf(() => accept(seed(), WS, 'u-02', 'app-3'))).toBe('FORBIDDEN');
  });

  it('수락하면 합류하고 합류자의 다른 대기 제안은 자동 철회된다', () => {
    let db = publish(seed(), 'u-student');
    db = apply(db, WS, 'u-student', 't-1');
    const myApply = db.applications[db.applications.length - 1];
    db = accept(db, WS, 'u-student', 'app-1');
    expect(memberTeam(db, 'u-student')).toBe('t-3');
    expect(db.teams.find((team) => team.id === 't-3')!.memberIds).toContain('u-student');
    expect(db.applications.find((app) => app.id === myApply.id)!.status).toBe('AUTO_WITHDRAWN');
  });

  it('팀이 정원을 채우면 남은 대기 지원은 정원 마감으로 거절된다', () => {
    let db = accept(seed(), WS, 'u-01', 'app-3');
    expect(db.applications.find((app) => app.id === 'app-4')!.status).toBe('PENDING');
    db = accept(db, WS, 'u-01', 'app-4');
    expect(db.teams.find((team) => team.id === 't-1')!.memberIds).toHaveLength(4);
    expect(codeOf(() => scout(db, WS, 'u-01', 'u-09'))).toBe('CONFLICT');
  });

  it('정원이 찬 팀에 남은 지원은 DECLINED(정원 마감)로 바뀐다', () => {
    let db = seed();
    db = { ...db, sessions: db.sessions.map((session) => ({ ...session, teamCapacity: 3 })) };
    db = accept(db, WS, 'u-01', 'app-3');
    const rest = db.applications.find((app) => app.id === 'app-4')!;
    expect(rest.status).toBe('DECLINED');
    expect(rest.reason).toBe('정원 마감');
  });

  it('이미 처리된 제안은 다시 처리할 수 없다', () => {
    const db = decline(seed(), WS, 'u-01', 'app-3');
    expect(codeOf(() => accept(db, WS, 'u-01', 'app-3'))).toBe('CONFLICT');
  });
});

describe('철회와 팀 개설', () => {
  it('보낸 쪽만 철회할 수 있다', () => {
    expect(codeOf(() => withdraw(seed(), WS, 'u-01', 'app-3'))).toBe('FORBIDDEN');
    expect(withdraw(seed(), WS, 'u-03', 'app-3').applications.find((app) => app.id === 'app-3')!.status).toBe('WITHDRAWN');
  });

  it('팀을 만들면 팀장이 되고 내가 보낸 대기 지원은 자동 철회된다', () => {
    let db = apply(publish(seed(), 'u-student'), WS, 'u-student', 't-2');
    const result = createTeam(db, WS, 'u-student', { name: '새벽팀', recruitRoles: [{ role: 'BACKEND', count: 1 }] });
    db = result.db;
    expect(db.teams.find((team) => team.id === result.teamId)!.leaderId).toBe('u-student');
    expect(db.applications.filter((app) => app.applicantId === 'u-student' && app.direction === 'APPLY').every((app) => app.status !== 'PENDING')).toBe(true);
    expect(memberTeam(db, 'u-student')).toBe(result.teamId);
  });
});
