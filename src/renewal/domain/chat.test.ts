import { describe, expect, it } from 'vitest';
import { canAddMembers, canDeleteRoom, canLeaveRoom, canRenameRoom, mediaErrorGuide, roomTitle, searchMessages, unreadCount, type ChatMessage, type ChatRoom } from './chat';

const room = (kind: ChatRoom['kind'], extra: Partial<ChatRoom> = {}): ChatRoom => ({ id: 'r', workspaceId: 'w', kind, memberIds: ['a', 'b'], createdBy: 'a', createdAt: '', ...extra });
const msg = (id: string, authorId: string | undefined, content: string, createdAt: string): ChatMessage => ({ id, roomId: 'r', authorId, content, createdAt });
const names: Record<string, string> = { a: '김철수', b: '이영희', c: '박민준' };
const nameOf = (id: string) => names[id];

describe('방 권한', () => {
  it('그룹 방은 만든 사람이 이름을 바꾸고 지우며, 팀 방은 팀장이 이름만 바꾼다', () => {
    expect(canRenameRoom(room('GROUP'), { accountId: 'a', isTeamLeader: false })).toBe(true);
    expect(canRenameRoom(room('GROUP'), { accountId: 'b', isTeamLeader: false })).toBe(false);
    expect(canRenameRoom(room('TEAM'), { accountId: 'b', isTeamLeader: true })).toBe(true);
    expect(canDeleteRoom(room('TEAM'), { accountId: 'a', isTeamLeader: true })).toBe(false);
    expect(canRenameRoom(room('DM'), { accountId: 'a', isTeamLeader: false })).toBe(false);
  });

  it('팀 방은 나갈 수 없고 멤버 추가는 그룹 방에서만 한다', () => {
    expect(canLeaveRoom(room('TEAM'))).toBe(false);
    expect(canAddMembers(room('GROUP'), { accountId: 'b', isTeamLeader: false })).toBe(true);
    expect(canAddMembers(room('DM'), { accountId: 'a', isTeamLeader: false })).toBe(false);
  });
});

describe('표시', () => {
  it('DM은 상대 이름, 이름 없는 그룹은 다른 멤버 이름으로 부른다', () => {
    expect(roomTitle(room('DM'), 'a', nameOf)).toBe('이영희');
    expect(roomTitle(room('GROUP', { memberIds: ['a', 'b', 'c'] }), 'a', nameOf)).toBe('이영희, 박민준');
    expect(roomTitle(room('GROUP', { title: '스터디' }), 'a', nameOf)).toBe('스터디');
  });

  it('읽지 않은 수는 마지막으로 읽은 뒤 남이 보낸 메시지만 센다', () => {
    const messages = [msg('1', 'b', '안녕', '2026-11-04T10:00'), msg('2', 'a', '응', '2026-11-04T10:01'), msg('3', 'b', '회의', '2026-11-04T10:02'), msg('4', undefined, '입장', '2026-11-04T10:03')];
    expect(unreadCount(messages, 'a', '2026-11-04T10:00')).toBe(1);
    expect(unreadCount(messages, 'a')).toBe(2);
  });

  it('검색은 대소문자를 가리지 않고 최신순이며 시스템 안내는 뺀다', () => {
    const messages = [msg('1', 'b', 'API 회의', '2026-11-04T10:00'), msg('2', 'a', 'api 정리', '2026-11-04T10:05'), msg('3', undefined, 'api 방 입장', '2026-11-04T10:06')];
    expect(searchMessages(messages, 'Api').map((item) => item.id)).toEqual(['2', '1']);
    expect(searchMessages(messages, ' ')).toEqual([]);
  });
});

describe('mediaErrorGuide', () => {
  it('권한 거부와 장치 없음을 다르게 안내한다', () => {
    expect(mediaErrorGuide(new DOMException('denied', 'NotAllowedError')).title).toContain('권한');
    expect(mediaErrorGuide(new DOMException('none', 'NotFoundError')).title).toContain('찾지 못했어요');
  });
});
