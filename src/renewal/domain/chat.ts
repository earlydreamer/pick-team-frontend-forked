/**
 * 채팅·화상회의 도메인. 근거: docs/renewal/spec/15-communication.md.
 *
 * | 방 종류 | 멤버 | 이름 바꾸기 | 멤버 추가 | 나가기 | 삭제 |
 * |---|---|---|---|---|---|
 * | TEAM | 팀원(팀 소속을 따른다) | 팀장 | 팀 소속으로만 | 팀을 나가야 함 | 팀 삭제 시 |
 * | DM | 두 사람 | 없음 | 없음 | 가능 | 없음 |
 * | GROUP | 만든 사람이 고른 멤버 | 만든 사람 | 방 멤버 | 가능 | 만든 사람 |
 */

export type ChatRoomKind = 'TEAM' | 'DM' | 'GROUP';

export interface ChatRoom {
  id: string;
  workspaceId: string;
  kind: ChatRoomKind;
  /** GROUP·TEAM 방 이름. DM은 상대 이름으로 표시한다 */
  title?: string;
  teamId?: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  /** 없으면 시스템 안내(입장·퇴장) */
  authorId?: string;
  content: string;
  createdAt: string;
}

export const CHAT_LIMITS = { messageMax: 1000, titleMax: 30, searchMin: 1 } as const;

export interface ChatRoomSummary {
  room: ChatRoom;
  title: string;
  unread: number;
  lastMessage?: ChatMessage;
  muted: boolean;
}

export interface ChatViewer {
  accountId: string;
  /** TEAM 방일 때 그 팀의 팀장인지 */
  isTeamLeader: boolean;
}

export const canRenameRoom = (room: ChatRoom, viewer: ChatViewer) =>
  room.kind === 'GROUP' ? room.createdBy === viewer.accountId : room.kind === 'TEAM' ? viewer.isTeamLeader : false;
export const canAddMembers = (room: ChatRoom, viewer: ChatViewer) => room.kind === 'GROUP' && room.memberIds.includes(viewer.accountId);
export const canLeaveRoom = (room: ChatRoom) => room.kind !== 'TEAM';
export const canDeleteRoom = (room: ChatRoom, viewer: ChatViewer) => room.kind === 'GROUP' && room.createdBy === viewer.accountId;

/** 방 이름. DM은 상대 이름, 이름 없는 그룹은 멤버 이름을 이어 쓴다. */
export const roomTitle = (room: ChatRoom, viewerId: string, nameOf: (id: string) => string) => {
  if (room.kind === 'DM') return nameOf(room.memberIds.find((id) => id !== viewerId) ?? viewerId);
  if (room.title) return room.title;
  return room.memberIds.filter((id) => id !== viewerId).map(nameOf).join(', ') || '나만 있는 방';
};

/** 읽지 않은 메시지: 마지막으로 읽은 뒤 다른 사람이 보낸 메시지(시스템 안내 제외). */
export const unreadCount = (messages: ChatMessage[], viewerId: string, lastReadAt?: string) =>
  messages.filter((message) => message.authorId && message.authorId !== viewerId && (!lastReadAt || message.createdAt > lastReadAt)).length;

/** 방 안 검색(15 §4.2): 대소문자를 가리지 않는 포함 검색, 최신순. 시스템 안내는 빼고 찾는다. */
export const searchMessages = (messages: ChatMessage[], keyword: string) => {
  const query = keyword.trim().toLowerCase();
  if (query.length < CHAT_LIMITS.searchMin) return [];
  return messages.filter((message) => message.authorId && message.content.toLowerCase().includes(query)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const validateMessage = (content: string) => {
  if (!content.trim()) return '메시지를 입력해 주세요.';
  if (content.length > CHAT_LIMITS.messageMax) return `메시지는 ${CHAT_LIMITS.messageMax}자까지 보낼 수 있어요.`;
  return undefined;
};

/* ── 화상회의 ── */

export interface VideoChannel {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
}

/**
 * 카메라·마이크 오류를 사람이 할 일로 바꾼다(15 US-15-07). getUserMedia가 던지는 DOMException 이름을 기준으로 한다.
 */
export const mediaErrorGuide = (error: unknown): { title: string; description: string } => {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      title: '카메라와 마이크 권한이 꺼져 있어요',
      description: '주소창 왼쪽의 사이트 정보 아이콘에서 카메라와 마이크를 허용한 뒤 다시 시도해 주세요. 카메라와 마이크를 끈 채로 참여할 수도 있어요.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { title: '카메라나 마이크를 찾지 못했어요', description: '장치가 연결돼 있는지 확인해 주세요. 장치 없이도 참여할 수 있어요.' };
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return { title: '다른 앱이 카메라를 쓰고 있어요', description: '화상회의 앱이나 다른 탭에서 카메라를 끈 뒤 다시 시도해 주세요.' };
  }
  if (name === 'UnsupportedError') {
    return { title: '이 브라우저에서는 카메라를 쓸 수 없어요', description: 'https 주소에서 최신 Chrome, Edge, Safari로 접속해 주세요.' };
  }
  return { title: '카메라와 마이크를 켜지 못했어요', description: '잠시 뒤 다시 시도하거나, 장치 없이 참여해 주세요.' };
};
