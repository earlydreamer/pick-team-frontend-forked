import { describe, expect, it } from 'vitest';
import { canEditAuthored, canEditSchedule, dateKey, monthGrid, occursOn, validateSchedule, weekDays } from './collab';

const member = { accountId: 'a', isLeader: false };
const leader = { accountId: 'l', isLeader: true };

describe('일정 권한', () => {
  it('팀 일정은 만든 사람과 팀장이, 개인 일정은 만든 사람만 고친다', () => {
    expect(canEditSchedule({ createdBy: 'a', personal: false }, member)).toBe(true);
    expect(canEditSchedule({ createdBy: 'b', personal: false }, member)).toBe(false);
    expect(canEditSchedule({ createdBy: 'b', personal: false }, leader)).toBe(true);
    expect(canEditSchedule({ createdBy: 'b', personal: true }, leader)).toBe(false);
  });

  it('게시글과 댓글은 쓴 사람과 팀장이 고친다', () => {
    expect(canEditAuthored('a', member)).toBe(true);
    expect(canEditAuthored('b', member)).toBe(false);
    expect(canEditAuthored('b', leader)).toBe(true);
  });
});

describe('일정 검증', () => {
  it('이름은 필수이고 끝나는 시각이 시작보다 앞이면 안 된다', () => {
    const base = { title: '회의', type: 'MEETING' as const, personal: false, startAt: '2026-11-05T10:00:00.000Z', endAt: '2026-11-05T11:00:00.000Z' };
    expect(validateSchedule(base)).toEqual({});
    expect(validateSchedule({ ...base, title: '' }).title).toBeDefined();
    expect(validateSchedule({ ...base, endAt: '2026-11-05T09:00:00.000Z' }).endAt).toBeDefined();
  });
});

describe('달력 계산', () => {
  it('2026년 11월은 일요일에 시작해 5주로 그린다', () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(5);
    expect(dateKey(grid[0][0])).toBe('2026-11-01');
    expect(dateKey(grid[4][6])).toBe('2026-12-05');
  });

  it('주는 일요일부터 토요일까지다', () => {
    const days = weekDays(new Date(2026, 10, 5));
    expect(dateKey(days[0])).toBe('2026-11-01');
    expect(dateKey(days[6])).toBe('2026-11-07');
  });

  it('여러 날 일정은 걸친 날마다 보인다', () => {
    const schedule = { startAt: new Date(2026, 10, 5, 22).toISOString(), endAt: new Date(2026, 10, 6, 2).toISOString() };
    expect(occursOn(schedule, new Date(2026, 10, 5))).toBe(true);
    expect(occursOn(schedule, new Date(2026, 10, 6))).toBe(true);
    expect(occursOn(schedule, new Date(2026, 10, 7))).toBe(false);
  });
});
