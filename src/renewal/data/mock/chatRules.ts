import {
  CHAT_LIMITS,
  canAddMembers,
  canDeleteRoom,
  canLeaveRoom,
  canRenameRoom,
  roomTitle,
  searchMessages,
  unreadCount,
  validateMessage,
  type ChatMessage,
  type ChatRoom,
  type ChatRoomSummary,
  type ChatViewer,
} from '@/renewal/domain/chat';
import { DataError } from '../ports';
import type { MockDb } from './db';

/*
 * 채팅·화상회의 규칙(15). 팀 방과 팀 회의실은 팀마다 하나씩 자동으로 만들고(15-D3),
 * 팀 방 멤버는 팀 소속을 그대로 따른다. 개설자·매니저는 자기가 속한 방만 보고 팀 방 내용은 보지 않는다(15-D2).
 */

const now = () => new Date().toISOString();
let sequence = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(sequence++).toString(36)}`;
const nameOf = (db: MockDb) => (id: string) => db.accounts.find((account) => account.id === id)?.name ?? '알 수 없음';

const requireWorkspaceMember = (db: MockDb, workspaceId: string, accountId: string) => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  if (!workspace || !workspace.members.some((member) => member.accountId === accountId)) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  return workspace;
};

/** 팀이 있는데 팀 방·회의실이 없으면 만든다(팀 결성 직후 자동 생성, 15-D3). */
export const ensureTeamRooms = (db: MockDb, workspaceId: string): MockDb => {
  const teams = db.teams.filter((team) => team.workspaceId === workspaceId);
  const missingRooms = teams.filter((team) => !db.chatRooms.some((room) => room.kind === 'TEAM' && room.teamId === team.id));
  const missingChannels = teams.filter((team) => !db.videoChannels.some((channel) => channel.teamId === team.id));
  if (missingRooms.length === 0 && missingChannels.length === 0) return db;
  const rooms: ChatRoom[] = missingRooms.map((team) => ({
    id: `cr-${team.id}`,
    workspaceId,
    kind: 'TEAM',
    title: `${team.name} 채팅방`,
    teamId: team.id,
    memberIds: [],
    createdBy: team.leaderId,
    createdAt: now(),
  }));
  return {
    ...db,
    chatRooms: [...db.chatRooms, ...rooms],
    chatMessages: [...db.chatMessages, ...rooms.map((room) => ({ id: newId('m'), roomId: room.id, content: `${room.title}이 만들어졌어요.`, createdAt: now() }))],
    videoChannels: [...db.videoChannels, ...missingChannels.map((team) => ({ id: `vc-${team.id}`, workspaceId, teamId: team.id, name: `${team.name} 회의실` }))],
  };
};

/** 방의 실제 멤버. 팀 방은 지금의 팀 소속이다. 지워진 팀의 방은 아무도 없는 방이 된다. */
export const membersOf = (db: MockDb, room: ChatRoom) => (room.kind === 'TEAM' ? db.teams.find((team) => team.id === room.teamId)?.memberIds ?? [] : room.memberIds);

const viewerOf = (db: MockDb, room: ChatRoom, accountId: string): ChatViewer => ({
  accountId,
  isTeamLeader: room.kind === 'TEAM' && db.teams.find((team) => team.id === room.teamId)?.leaderId === accountId,
});

/** 방에 들어갈 수 있는지. 멤버가 아니면 방의 존재를 숨긴다. */
const requireRoom = (db: MockDb, workspaceId: string, roomId: string, accountId: string) => {
  requireWorkspaceMember(db, workspaceId, accountId);
  const room = db.chatRooms.find((item) => item.id === roomId && item.workspaceId === workspaceId);
  if (!room || !membersOf(db, room).includes(accountId)) throw new DataError('채팅방을 찾을 수 없어요.', 'NOT_FOUND');
  return { ...room, memberIds: membersOf(db, room) };
};

const readKey = (roomId: string, accountId: string) => `${roomId}:${accountId}`;

export const listRooms = (db: MockDb, workspaceId: string, accountId: string): ChatRoomSummary[] => {
  requireWorkspaceMember(db, workspaceId, accountId);
  return db.chatRooms
    .filter((room) => room.workspaceId === workspaceId && membersOf(db, room).includes(accountId))
    .map((room) => {
      const messages = db.chatMessages.filter((message) => message.roomId === room.id);
      const full = { ...room, memberIds: membersOf(db, room) };
      return {
        room: full,
        title: roomTitle(full, accountId, nameOf(db)),
        unread: unreadCount(messages, accountId, db.chatReads[readKey(room.id, accountId)]),
        lastMessage: messages[messages.length - 1],
        muted: db.chatMutes.includes(readKey(room.id, accountId)),
      };
    })
    .sort((a, b) => (b.lastMessage?.createdAt ?? b.room.createdAt).localeCompare(a.lastMessage?.createdAt ?? a.room.createdAt));
};

export const getRoom = (db: MockDb, workspaceId: string, roomId: string, accountId: string) => {
  const room = requireRoom(db, workspaceId, roomId, accountId);
  const viewer = viewerOf(db, room, accountId);
  return {
    room,
    title: roomTitle(room, accountId, nameOf(db)),
    members: room.memberIds.map((id) => db.accounts.find((account) => account.id === id)!).filter(Boolean),
    muted: db.chatMutes.includes(readKey(room.id, accountId)),
    permissions: { rename: canRenameRoom(room, viewer), addMembers: canAddMembers(room, viewer), leave: canLeaveRoom(room), delete: canDeleteRoom(room, viewer) },
  };
};

export const listMessages = (db: MockDb, workspaceId: string, roomId: string, accountId: string) => {
  requireRoom(db, workspaceId, roomId, accountId);
  return db.chatMessages.filter((message) => message.roomId === roomId);
};

export const sendMessage = (db: MockDb, workspaceId: string, roomId: string, accountId: string, content: string) => {
  requireRoom(db, workspaceId, roomId, accountId);
  const error = validateMessage(content);
  if (error) throw new DataError(error, 'INVALID');
  const message: ChatMessage = { id: newId('m'), roomId, authorId: accountId, content: content.trim(), createdAt: now() };
  // 내가 보낸 메시지까지는 읽은 것으로 본다.
  return { db: { ...db, chatMessages: [...db.chatMessages, message], chatReads: { ...db.chatReads, [readKey(roomId, accountId)]: message.createdAt } }, message };
};

export const markRead = (db: MockDb, workspaceId: string, roomId: string, accountId: string): MockDb => {
  requireRoom(db, workspaceId, roomId, accountId);
  return { ...db, chatReads: { ...db.chatReads, [readKey(roomId, accountId)]: now() } };
};

export const search = (db: MockDb, workspaceId: string, roomId: string, accountId: string, keyword: string) =>
  searchMessages(listMessages(db, workspaceId, roomId, accountId), keyword);

const systemMessage = (roomId: string, content: string): ChatMessage => ({ id: newId('m'), roomId, content, createdAt: now() });

/** 그룹 방 만들기. 멤버가 한 명이고 이름이 없으면 DM으로 연다. */
export const createGroup = (db: MockDb, workspaceId: string, accountId: string, input: { title?: string; memberIds: string[] }) => {
  const workspace = requireWorkspaceMember(db, workspaceId, accountId);
  const others = [...new Set(input.memberIds)].filter((id) => id !== accountId);
  if (others.length === 0) throw new DataError('함께할 사람을 한 명 이상 골라 주세요.', 'INVALID');
  if (others.some((id) => !workspace.members.some((member) => member.accountId === id))) throw new DataError('워크스페이스 멤버만 초대할 수 있어요.', 'INVALID');
  const title = input.title?.trim();
  if (title && title.length > CHAT_LIMITS.titleMax) throw new DataError(`방 이름은 ${CHAT_LIMITS.titleMax}자까지 쓸 수 있어요.`, 'INVALID');
  if (others.length === 1 && !title) return openDm(db, workspaceId, accountId, others[0]);
  const room: ChatRoom = { id: newId('cr'), workspaceId, kind: 'GROUP', title, memberIds: [accountId, ...others], createdBy: accountId, createdAt: now() };
  return { db: { ...db, chatRooms: [...db.chatRooms, room], chatMessages: [...db.chatMessages, systemMessage(room.id, `${nameOf(db)(accountId)}님이 방을 만들었어요.`)] }, roomId: room.id };
};

/** DM 시작(15 US-15-01): 이미 있는 DM이면 그 방을, 없으면 새로 만든다. */
export const openDm = (db: MockDb, workspaceId: string, accountId: string, targetId: string) => {
  const workspace = requireWorkspaceMember(db, workspaceId, accountId);
  if (targetId === accountId || !workspace.members.some((member) => member.accountId === targetId)) throw new DataError('대화할 상대를 찾을 수 없어요.', 'NOT_FOUND');
  const existing = db.chatRooms.find((room) => room.workspaceId === workspaceId && room.kind === 'DM' && room.memberIds.includes(accountId) && room.memberIds.includes(targetId));
  if (existing) return { db, roomId: existing.id };
  const room: ChatRoom = { id: newId('cr'), workspaceId, kind: 'DM', memberIds: [accountId, targetId], createdBy: accountId, createdAt: now() };
  return { db: { ...db, chatRooms: [...db.chatRooms, room] }, roomId: room.id };
};

const replaceRoom = (db: MockDb, room: ChatRoom): MockDb => ({ ...db, chatRooms: db.chatRooms.map((item) => (item.id === room.id ? room : item)) });

export const renameRoom = (db: MockDb, workspaceId: string, roomId: string, accountId: string, title: string): MockDb => {
  const room = requireRoom(db, workspaceId, roomId, accountId);
  if (!canRenameRoom(room, viewerOf(db, room, accountId))) throw new DataError('방 이름은 방을 만든 사람(팀 방은 팀장)만 바꿀 수 있어요.', 'FORBIDDEN');
  const next = title.trim();
  if (!next) throw new DataError('방 이름을 입력해 주세요.', 'INVALID');
  if (next.length > CHAT_LIMITS.titleMax) throw new DataError(`방 이름은 ${CHAT_LIMITS.titleMax}자까지 쓸 수 있어요.`, 'INVALID');
  const stored = db.chatRooms.find((item) => item.id === roomId)!;
  return replaceRoom(db, { ...stored, title: next });
};

/** 그룹 방 멤버 추가. 들어온 사람마다 입장 안내를 남긴다(15 §5.1 CHAT_MEMBER_JOINED). */
export const addMembers = (db: MockDb, workspaceId: string, roomId: string, accountId: string, memberIds: string[]): MockDb => {
  const room = requireRoom(db, workspaceId, roomId, accountId);
  if (!canAddMembers(room, viewerOf(db, room, accountId))) throw new DataError('그룹 방에서만 멤버를 추가할 수 있어요.', 'FORBIDDEN');
  const workspace = requireWorkspaceMember(db, workspaceId, accountId);
  const added = [...new Set(memberIds)].filter((id) => !room.memberIds.includes(id) && workspace.members.some((member) => member.accountId === id));
  if (added.length === 0) throw new DataError('추가할 사람을 골라 주세요.', 'INVALID');
  const stored = db.chatRooms.find((item) => item.id === roomId)!;
  const next = replaceRoom(db, { ...stored, memberIds: [...stored.memberIds, ...added] });
  return { ...next, chatMessages: [...next.chatMessages, ...added.map((id) => systemMessage(roomId, `${nameOf(db)(id)}님이 참여했어요.`))] };
};

/** 방 나가기. 팀 방은 팀을 나가야 빠진다. 퇴장 안내를 남긴다(CHAT_MEMBER_LEFT). */
export const leaveRoom = (db: MockDb, workspaceId: string, roomId: string, accountId: string): MockDb => {
  const room = requireRoom(db, workspaceId, roomId, accountId);
  if (!canLeaveRoom(room)) throw new DataError('팀 채팅방은 팀을 나가면 함께 빠져요.', 'CONFLICT');
  const stored = db.chatRooms.find((item) => item.id === roomId)!;
  const next = replaceRoom(db, { ...stored, memberIds: stored.memberIds.filter((id) => id !== accountId) });
  return { ...next, chatMessages: [...next.chatMessages, systemMessage(roomId, `${nameOf(db)(accountId)}님이 나갔어요.`)] };
};

export const deleteRoom = (db: MockDb, workspaceId: string, roomId: string, accountId: string): MockDb => {
  const room = requireRoom(db, workspaceId, roomId, accountId);
  if (!canDeleteRoom(room, viewerOf(db, room, accountId))) throw new DataError('그룹 방을 만든 사람만 지울 수 있어요.', 'FORBIDDEN');
  return { ...db, chatRooms: db.chatRooms.filter((item) => item.id !== roomId), chatMessages: db.chatMessages.filter((message) => message.roomId !== roomId) };
};

/** 방별 알림 끄기(15 US-15-04). 저장 모델 정본은 16 §7 ChatRoomMuteStatus다. */
export const setMuted = (db: MockDb, workspaceId: string, roomId: string, accountId: string, muted: boolean): MockDb => {
  requireRoom(db, workspaceId, roomId, accountId);
  const key = readKey(roomId, accountId);
  const others = db.chatMutes.filter((item) => item !== key);
  return { ...db, chatMutes: muted ? [...others, key] : others };
};

/* ── 화상회의(15 §4.3, §5.4) ── */

/** 내가 속한 팀의 회의실만 보인다. */
export const listChannels = (db: MockDb, workspaceId: string, accountId: string) => {
  requireWorkspaceMember(db, workspaceId, accountId);
  return db.videoChannels.filter((channel) => channel.workspaceId === workspaceId && db.teams.find((team) => team.id === channel.teamId)?.memberIds.includes(accountId));
};

const requireChannel = (db: MockDb, workspaceId: string, channelId: string, accountId: string) => {
  const channel = listChannels(db, workspaceId, accountId).find((item) => item.id === channelId);
  if (!channel) throw new DataError('회의실을 찾을 수 없어요.', 'NOT_FOUND');
  return channel;
};

export const getChannel = (db: MockDb, workspaceId: string, channelId: string, accountId: string) => {
  const channel = requireChannel(db, workspaceId, channelId, accountId);
  const participants = db.videoPresence
    .filter((item) => item.channelId === channelId)
    .map((item) => db.accounts.find((account) => account.id === item.accountId)!)
    .filter(Boolean);
  return { channel, participants };
};

export const joinChannel = (db: MockDb, workspaceId: string, channelId: string, accountId: string): MockDb => {
  requireChannel(db, workspaceId, channelId, accountId);
  if (db.videoPresence.some((item) => item.channelId === channelId && item.accountId === accountId)) return db;
  return { ...db, videoPresence: [...db.videoPresence, { channelId, accountId, joinedAt: now() }] };
};

/** 나가면 참여 기록을 지운다(15 §5.4 VideoMember 정리). */
export const leaveChannel = (db: MockDb, workspaceId: string, channelId: string, accountId: string): MockDb => {
  requireWorkspaceMember(db, workspaceId, accountId);
  return { ...db, videoPresence: db.videoPresence.filter((item) => !(item.channelId === channelId && item.accountId === accountId)) };
};
