import { describe, expect, it } from 'vitest';
import { seed, type MockDb } from './db';
import { DataError } from '../ports';
import { addMembers, createGroup, deleteRoom, ensureTeamRooms, getChannel, getRoom, joinChannel, leaveChannel, leaveRoom, listChannels, listRooms, markRead, openDm, renameRoom, sendMessage } from './chatRules';
import { leaveTeam } from './teamSettingsRules';

const WS = 'ws-1';
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof DataError ? error.code : 'OTHER';
  }
  return 'NONE';
};
const summary = (db: MockDb, accountId: string, roomId: string) => listRooms(db, WS, accountId).find((item) => item.room.id === roomId);

describe('방 목록과 접근', () => {
  it('내가 속한 방만 보이고, 팀 방 멤버는 팀 소속을 따른다', () => {
    expect(listRooms(seed(), WS, 'u-01').map((item) => item.room.id).sort()).toEqual(['cr-dm1', 'cr-g1', 'cr-t1']);
    expect(codeOf(() => getRoom(seed(), WS, 'cr-t1', 'u-03'))).toBe('NOT_FOUND');
    const left = leaveTeam(seed(), WS, 't-1', 'u-02').db;
    expect(codeOf(() => getRoom(left, WS, 'cr-t1', 'u-02'))).toBe('NOT_FOUND');
  });

  it('매니저는 팀 방 내용을 보지 못한다(15-D2)', () => {
    expect(codeOf(() => getRoom(seed(), WS, 'cr-t1', 'u-instructor'))).toBe('NOT_FOUND');
  });

  it('새 팀에는 팀 방과 회의실이 자동으로 생긴다(15-D3)', () => {
    const base = seed();
    const db = ensureTeamRooms({ ...base, teams: [...base.teams, { id: 't-9', workspaceId: WS, name: '새벽', leaderId: 'u-03', memberIds: ['u-03'], recruitRoles: [] }] }, WS);
    expect(db.chatRooms.some((room) => room.teamId === 't-9')).toBe(true);
    expect(listChannels(db, WS, 'u-03').map((channel) => channel.teamId)).toEqual(['t-9']);
  });
});

describe('메시지와 읽음', () => {
  it('읽지 않은 수는 읽음 처리 뒤 0이 되고, 보낸 사람에게는 늘지 않는다', () => {
    expect(summary(seed(), 'u-01', 'cr-t1')?.unread).toBe(1);
    expect(summary(markRead(seed(), WS, 'cr-t1', 'u-01'), 'u-01', 'cr-t1')?.unread).toBe(0);
    const sent = sendMessage(seed(), WS, 'cr-t1', 'u-02', '확인했어요').db;
    expect(summary(sent, 'u-02', 'cr-t1')?.unread).toBe(0);
    expect(summary(sent, 'u-01', 'cr-t1')?.unread).toBe(2);
  });

  it('빈 메시지는 보내지 못한다', () => {
    expect(codeOf(() => sendMessage(seed(), WS, 'cr-t1', 'u-01', '  '))).toBe('INVALID');
  });
});

describe('DM과 그룹 방', () => {
  it('DM은 이미 있으면 그 방을 연다', () => {
    expect(openDm(seed(), WS, 'u-02', 'u-01').roomId).toBe('cr-dm1');
    const created = openDm(seed(), WS, 'u-01', 'u-05');
    expect(created.db.chatRooms.find((room) => room.id === created.roomId)?.kind).toBe('DM');
  });

  it('한 명만 고르고 이름이 없으면 DM으로 연다', () => {
    expect(createGroup(seed(), WS, 'u-02', { memberIds: ['u-01'] }).roomId).toBe('cr-dm1');
  });

  it('그룹 방 멤버 추가·나가기에 안내문이 남고, 이름 변경·삭제는 만든 사람만 한다', () => {
    let db = addMembers(seed(), WS, 'cr-g1', 'u-03', ['u-07']);
    expect(db.chatMessages[db.chatMessages.length - 1].content).toBe('윤지호님이 참여했어요.');
    db = leaveRoom(db, WS, 'cr-g1', 'u-student');
    const last = db.chatMessages[db.chatMessages.length - 1];
    expect(last.content).toBe('김수강님이 나갔어요.');
    expect(last.authorId).toBeUndefined();
    expect(codeOf(() => renameRoom(db, WS, 'cr-g1', 'u-03', '이름'))).toBe('FORBIDDEN');
    expect(codeOf(() => deleteRoom(db, WS, 'cr-g1', 'u-03'))).toBe('FORBIDDEN');
    expect(deleteRoom(db, WS, 'cr-g1', 'u-01').chatRooms.some((room) => room.id === 'cr-g1')).toBe(false);
  });

  it('팀 방은 나갈 수 없고, 이름은 팀장이 바꾼다', () => {
    expect(codeOf(() => leaveRoom(seed(), WS, 'cr-t1', 'u-02'))).toBe('CONFLICT');
    expect(codeOf(() => renameRoom(seed(), WS, 'cr-t1', 'u-02', '새 이름'))).toBe('FORBIDDEN');
    expect(codeOf(() => renameRoom(seed(), WS, 'cr-t1', 'u-01', '새 이름'))).toBe('NONE');
  });
});

describe('화상회의', () => {
  it('내 팀 회의실만 들어가고, 나가면 참여 기록이 지워진다', () => {
    expect(codeOf(() => joinChannel(seed(), WS, 'vc-t1', 'u-03'))).toBe('NOT_FOUND');
    let db = joinChannel(seed(), WS, 'vc-t1', 'u-01');
    expect(getChannel(db, WS, 'vc-t1', 'u-01').participants.map((account) => account.id).sort()).toEqual(['u-01', 'u-02']);
    db = leaveChannel(db, WS, 'vc-t1', 'u-01');
    expect(getChannel(db, WS, 'vc-t1', 'u-01').participants.map((account) => account.id)).toEqual(['u-02']);
  });
});
