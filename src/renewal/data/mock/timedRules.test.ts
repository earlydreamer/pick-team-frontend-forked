import { describe, expect, it } from 'vitest';
import { seed, type MockDb } from './db';
import { runTimedEvents } from './timedRules';

const NOW = Date.UTC(2026, 10, 5, 12);
const hours = (n: number) => new Date(NOW + n * 3_600_000).toISOString();
const minutes = (n: number) => new Date(NOW + n * 60_000).toISOString();
const added = (before: MockDb, after: MockDb) => after.notifications.filter((item) => !before.notifications.some((old) => old.id === item.id));

const closingSoon = (closesAt: string): MockDb => {
  const db = seed();
  return { ...db, schedules: [], sessions: db.sessions.map((session) => ({ ...session, closesAt })) };
};

describe('팀 빌딩 마감 임박(16-D3)', () => {
  it('마감 24시간 안이면 팀이 없는 멤버와 운영진에게 한 번씩 알린다', () => {
    const before = closingSoon(hours(10));
    const after = runTimedEvents(before, NOW);
    const news = added(before, after);
    const closing = news.filter((item) => item.type === 'TB_SESSION_CLOSING_SOON').map((item) => item.accountId);
    const warning = news.filter((item) => item.type === 'TB_UNASSIGNED_WARNING').map((item) => item.accountId);
    expect(closing).toContain('u-student');
    expect(closing).not.toContain('u-01');
    expect(warning.sort()).toEqual(['u-instructor', 'u-manager']);
    expect(news.find((item) => item.type === 'TB_UNASSIGNED_WARNING')?.title).toContain('10시간 전');
    expect(added(after, runTimedEvents(after, NOW + 60_000))).toHaveLength(0);
  });

  it('24시간보다 많이 남았거나 이미 마감됐으면 보내지 않는다', () => {
    expect(added(closingSoon(hours(30)), runTimedEvents(closingSoon(hours(30)), NOW))).toHaveLength(0);
    expect(added(closingSoon(hours(-1)), runTimedEvents(closingSoon(hours(-1)), NOW))).toHaveLength(0);
  });

  it('마감 시각을 미루면 새 마감 기준으로 다시 알린다', () => {
    const first = runTimedEvents(closingSoon(hours(10)), NOW);
    const moved = { ...first, sessions: first.sessions.map((session) => ({ ...session, closesAt: hours(20) })) };
    expect(added(moved, runTimedEvents(moved, NOW)).length).toBeGreaterThan(0);
  });
});

describe('일정 리마인더(16-D4)', () => {
  it('시작 5분 전 안이면 팀 일정은 팀원, 개인 일정은 만든 사람에게 알린다', () => {
    const db = seed();
    const before: MockDb = {
      ...db,
      sessions: [],
      schedules: db.schedules.map((item) => (item.id === 'sc-1' ? { ...item, startAt: minutes(3) } : item.id === 'sc-3' ? { ...item, startAt: minutes(4) } : { ...item, startAt: hours(48) })),
    };
    const news = added(before, runTimedEvents(before, NOW));
    const team = news.filter((item) => item.title.includes('스프린트 회의')).map((item) => item.accountId).sort();
    const personal = news.filter((item) => item.title.includes('병원 예약')).map((item) => item.accountId);
    expect(team).toEqual(['u-01', 'u-02']);
    expect(personal).toEqual(['u-01']);
    expect(news[0]).toMatchObject({ type: 'SCHEDULE_REMINDER', category: 'SCHEDULE', priority: 'HIGH' });
    expect(news.find((item) => item.title.includes('스프린트'))?.title).toBe('3분 뒤 시작: 스프린트 회의');
  });

  it('수신 설정에서 일정 계열을 끄면 받지 않는다', () => {
    const db = seed();
    const before: MockDb = {
      ...db,
      sessions: [],
      notificationSettings: { 'u-02': { enabled: true, categories: { TEAM_BUILDING: true, KANBAN: true, SCHEDULE: false, ANNOUNCEMENT: true, CHAT: true, MEMBERSHIP: true } } },
      schedules: db.schedules.map((item) => (item.id === 'sc-1' ? { ...item, startAt: minutes(2) } : { ...item, startAt: hours(48) })),
    };
    expect(added(before, runTimedEvents(before, NOW)).map((item) => item.accountId)).toEqual(['u-01']);
  });
});
