import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/renewal/domain/notification';
import { seed, type MockDb } from './db';
import * as rules from './rules';
import { sendMessage, setMuted } from './chatRules';
import { lastApplicationId, onApplicationCreated, onApplicationDecided, onCardReminder, onChatMessage, onTaskTransition, readChatNotifications } from './notifyRules';
import { transition } from './kanbanRules';

const WS = 'ws-1';
const inboxOf = (db: MockDb, accountId: string) => db.notifications.filter((item) => item.accountId === accountId);
const publish = (db: MockDb, id: string): MockDb => ({ ...db, cards: { ...db.cards, [id]: { ...db.cards['u-01'] } } });

describe('알림 기록', () => {
  it('지원하면 팀장에게만 알림이 가고 지원한 사람에게는 가지 않는다', () => {
    let db = rules.apply(publish(seed(), 'u-student'), WS, 'u-student', 't-2');
    db = onApplicationCreated(db, WS, lastApplicationId(db), 'u-student');
    const leader = inboxOf(db, 'u-05');
    expect(leader[leader.length - 1]).toMatchObject({ type: 'TB_APPLICATION_RECEIVED', category: 'TEAM_BUILDING', read: false, link: '/ws/ws-1/team-building/inbox' });
    expect(inboxOf(db, 'u-student').length).toBe(inboxOf(seed(), 'u-student').length);
  });

  it('수락하면 지원자에게 팀 스페이스 링크로 알린다', () => {
    const db = onApplicationDecided(rules.accept(seed(), WS, 'u-01', 'app-3'), WS, 'app-3', 'u-01');
    expect(inboxOf(db, 'u-03').pop()).toMatchObject({ type: 'TB_APPLICATION_ACCEPTED', link: '/ws/ws-1/team/t-1' });
  });

  it('수신 설정에서 계열을 끄면 기록하지 않는다', () => {
    const base = seed();
    const off: MockDb = { ...base, notificationSettings: { 'u-01': { ...defaultSettings(), categories: { ...defaultSettings().categories, KANBAN: false } } } };
    const db = onTaskTransition(transition(off, WS, 't-1', 'u-02', 'k-7', 'request'), WS, 't-1', 'k-7', 'request', undefined, 'u-02');
    expect(inboxOf(db, 'u-01').length).toBe(inboxOf(base, 'u-01').length);
  });

  it('반려는 완료를 요청한 사람에게 간다', () => {
    const db = onTaskTransition(transition(seed(), WS, 't-1', 'u-01', 'k-5', 'reject', '보완 필요'), WS, 't-1', 'k-5', 'reject', 'u-02', 'u-01');
    expect(inboxOf(db, 'u-02').pop()).toMatchObject({ type: 'KANBAN_TASK_COMPLETION_REJECTED', link: '/ws/ws-1/team/t-1/kanban?task=k-5' });
  });
});

describe('리마인드 알림', () => {
  it('카드 미작성자 리마인드는 대상자에게 카드 편집 링크로 간다', () => {
    const db = onCardReminder(seed(), WS, ['u-student'], 'u-instructor');
    expect(inboxOf(db, 'u-student').pop()).toMatchObject({ type: 'CARD_REMINDER', category: 'TEAM_BUILDING', link: '/me/card' });
  });
});

describe('채팅 알림', () => {
  const send = (db: MockDb, from: string, text: string) => onChatMessage(sendMessage(db, WS, 'cr-t1', from, text).db, WS, 'cr-t1', from);

  it('같은 방의 읽지 않은 알림은 하나로 묶고 개수를 센다', () => {
    let db = send(seed(), 'u-02', '하나');
    db = send(db, 'u-02', '둘');
    const chat = inboxOf(db, 'u-01').filter((item) => item.type === 'NEW_CHAT_MESSAGE');
    expect(chat).toHaveLength(1);
    expect(chat[0]).toMatchObject({ count: 2, title: '알파팀 채팅방 새 메시지 2개' });
  });

  it('방에 들어가 읽으면 채팅 알림도 읽음이 되고, 다음 메시지는 새로 쌓인다', () => {
    let db = readChatNotifications(send(seed(), 'u-02', '하나'), 'cr-t1', 'u-01');
    expect(inboxOf(db, 'u-01').filter((item) => item.type === 'NEW_CHAT_MESSAGE' && !item.read)).toHaveLength(0);
    db = send(db, 'u-02', '둘');
    expect(inboxOf(db, 'u-01').filter((item) => item.type === 'NEW_CHAT_MESSAGE' && !item.read)[0].count).toBe(1);
  });

  it('알림을 끈 방은 기록하지 않는다(16-D6)', () => {
    const db = send(setMuted(seed(), WS, 'cr-t1', 'u-01', true), 'u-02', '하나');
    expect(inboxOf(db, 'u-01').filter((item) => item.type === 'NEW_CHAT_MESSAGE')).toHaveLength(0);
  });
});
