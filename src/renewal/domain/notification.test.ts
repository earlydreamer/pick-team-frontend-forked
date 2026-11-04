import { describe, expect, it } from 'vitest';
import { dayGroup, defaultSettings, previewItems, railCounts, shouldDeliver, visibleCategories, type AppNotification } from './notification';

const item = (id: string, priority: AppNotification['priority'], createdAt: string): AppNotification => ({
  id, accountId: 'a', type: 'NEW_CHAT_MESSAGE', category: 'CHAT', priority, title: id, link: '/', read: false, createdAt,
});

describe('알림 규칙', () => {
  it('마스터 스위치나 계열을 끄면 남기지 않는다', () => {
    const settings = defaultSettings();
    expect(shouldDeliver('KANBAN_TASK_ASSIGNED', settings)).toBe(true);
    expect(shouldDeliver('KANBAN_TASK_ASSIGNED', { ...settings, categories: { ...settings.categories, KANBAN: false } })).toBe(false);
    expect(shouldDeliver('TB_SCOUT_RECEIVED', { ...settings, enabled: false })).toBe(false);
  });

  it('미리보기는 낮음 우선순위를 빼고 최신 5개다', () => {
    const items = [item('low', 'LOW', '2026-11-04T10:09'), ...Array.from({ length: 6 }, (_, index) => item(`n${index}`, 'MEDIUM', `2026-11-04T10:0${index}`))];
    expect(previewItems(items).map((entry) => entry.id)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1']);
  });

  it('날짜 묶음은 오늘, 어제, 날짜다', () => {
    const now = new Date(2026, 10, 4, 12);
    expect(dayGroup(new Date(2026, 10, 4, 1).toISOString(), now)).toBe('오늘');
    expect(dayGroup(new Date(2026, 10, 3, 23).toISOString(), now)).toBe('어제');
    expect(dayGroup(new Date(2026, 10, 1, 9).toISOString(), now)).toContain('11월 1일');
  });

  it('레일 배지는 워크스페이스에 마지막으로 들어온 뒤 생긴 미확인 알림만 센다', () => {
    const items: AppNotification[] = [
      { ...item('old', 'HIGH', '2026-11-04T09:00'), workspaceId: 'w1' },
      { ...item('new', 'HIGH', '2026-11-04T11:00'), workspaceId: 'w1' },
      { ...item('read', 'HIGH', '2026-11-04T11:00'), workspaceId: 'w1', read: true },
      { ...item('other', 'LOW', '2026-11-04T08:00'), workspaceId: 'w2' },
    ];
    expect(railCounts(items, { w1: '2026-11-04T10:00' })).toEqual({ w1: 1, w2: 1 });
  });

  it('멤버십·관리 설정은 매니저에게만 보인다', () => {
    expect(visibleCategories(false)).not.toContain('MEMBERSHIP');
    expect(visibleCategories(true)).toContain('MEMBERSHIP');
  });
});
