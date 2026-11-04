import { describe, expect, it } from 'vitest';
import { seed } from './db';
import { DataError } from '../ports';
import {
  addPostComment,
  createAnnouncement,
  createPost,
  createSchedule,
  deletePost,
  deletePostComment,
  deleteSchedule,
  listPosts,
  listSchedules,
  updateSchedule,
} from './collabRules';

const WS = 'ws-1';
const T1 = 't-1';
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof DataError ? error.code : 'OTHER';
  }
  return 'NONE';
};
const meeting = { title: '회의', type: 'MEETING' as const, startAt: '2026-11-10T10:00:00.000Z', endAt: '2026-11-10T11:00:00.000Z', personal: false };

describe('일정', () => {
  it('다른 사람의 개인 일정은 목록에 없다', () => {
    expect(listSchedules(seed(), WS, T1, 'u-01').some((item) => item.id === 'sc-3')).toBe(true);
    expect(listSchedules(seed(), WS, T1, 'u-02').some((item) => item.id === 'sc-3')).toBe(false);
  });

  it('다른 사람의 개인 일정은 고치거나 지울 때도 없는 것처럼 다룬다', () => {
    expect(codeOf(() => deleteSchedule(seed(), WS, T1, 'u-02', 'sc-3'))).toBe('NOT_FOUND');
  });

  it('팀원은 남이 만든 팀 일정을 고치지 못하고, 팀장은 고친다', () => {
    const { db, scheduleId } = createSchedule(seed(), WS, T1, 'u-01', meeting);
    expect(codeOf(() => updateSchedule(db, WS, T1, 'u-02', scheduleId, { ...meeting, title: '변경' }))).toBe('FORBIDDEN');
    const created = createSchedule(seed(), WS, T1, 'u-02', meeting);
    expect(updateSchedule(created.db, WS, T1, 'u-01', created.scheduleId, { ...meeting, title: '팀장 변경' }).schedules.find((item) => item.id === created.scheduleId)?.title).toBe('팀장 변경');
  });

  it('남이 만든 일정을 개인 일정으로 바꾸지 못한다', () => {
    const created = createSchedule(seed(), WS, T1, 'u-02', meeting);
    expect(codeOf(() => updateSchedule(created.db, WS, T1, 'u-01', created.scheduleId, { ...meeting, personal: true }))).toBe('INVALID');
  });

  it('매니저와 팀원이 아닌 멤버는 일정을 보지 못한다(13-D1)', () => {
    expect(codeOf(() => listSchedules(seed(), WS, T1, 'u-instructor'))).toBe('FORBIDDEN');
    expect(codeOf(() => listSchedules(seed(), WS, T1, 'u-03'))).toBe('NOT_FOUND');
  });
});

describe('게시판', () => {
  it('글은 최신순이고, 쓴 사람과 팀장만 지운다', () => {
    const { db, postId } = createPost(seed(), WS, T1, 'u-02', { title: '새 글', content: '내용' });
    expect(listPosts(db, WS, T1, 'u-01')[0].id).toBe(postId);
    expect(codeOf(() => deletePost(seed(), WS, T1, 'u-02', 'p-1'))).toBe('FORBIDDEN');
    expect(deletePost(seed(), WS, T1, 'u-01', 'p-2').posts.some((post) => post.id === 'p-2')).toBe(false);
  });

  it('댓글은 쓴 사람과 팀장만 지운다', () => {
    const db = addPostComment(seed(), WS, T1, 'u-01', 'p-2', '좋아요');
    const commentId = db.posts.find((post) => post.id === 'p-2')!.comments[0].id;
    expect(codeOf(() => deletePostComment(seed(), WS, T1, 'u-01', 'p-1', 'pc-1'))).toBe('NONE');
    expect(codeOf(() => deletePostComment(db, WS, T1, 'u-02', 'p-2', commentId))).toBe('FORBIDDEN');
  });
});

describe('팀 공지', () => {
  it('팀장만 쓰고, 워크스페이스 홈의 최근 공지에도 팀 이름과 함께 실린다', () => {
    expect(codeOf(() => createAnnouncement(seed(), WS, T1, 'u-02', { title: '공지', content: '내용' }))).toBe('FORBIDDEN');
    const { db, announcementId } = createAnnouncement(seed(), WS, T1, 'u-01', { title: '공지', content: '내용' });
    expect(db.announcements.find((item) => item.id === announcementId)).toMatchObject({ workspaceId: WS, teamName: '알파팀', authorName: '김철수' });
  });
});
