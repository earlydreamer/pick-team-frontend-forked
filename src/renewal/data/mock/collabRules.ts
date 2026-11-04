import {
  canEditAuthored,
  canEditSchedule,
  validateAnnouncement,
  validatePost,
  validateSchedule,
  POST_LIMITS,
  type AnnouncementInput,
  type CollabViewer,
  type PostInput,
  type ScheduleInput,
  type TeamAnnouncement,
} from '@/renewal/domain/collab';
import type { Schedule } from '@/renewal/domain/teamSpace';
import { DataError } from '../ports';
import type { MockDb } from './db';
import { teamAccess } from './kanbanRules';

/*
 * 일정·게시판·팀 공지 규칙(14 §2, §4.3~§4.5, §5.3). 모두 팀원 전용이며(13-D1) 수정 권한은 domain/collab.ts를 따른다.
 */

const now = () => new Date().toISOString();
let sequence = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(sequence++).toString(36)}`;

const memberViewer = (db: MockDb, workspaceId: string, teamId: string, accountId: string): CollabViewer => {
  const access = teamAccess(db, workspaceId, teamId, accountId);
  if (!access.isMember) throw new DataError('팀원만 볼 수 있어요.', 'FORBIDDEN');
  return { accountId, isLeader: access.isLeader };
};

const invalid = (errors: Record<string, string | undefined>) => {
  const first = Object.values(errors).find(Boolean);
  if (first) throw new DataError(first, 'INVALID');
};

/* ── 일정 ── */

/** 팀 일정과 내 개인 일정만 돌려준다. 다른 사람의 개인 일정은 보이지 않는다(14 §5.3). */
export const listSchedules = (db: MockDb, workspaceId: string, teamId: string, accountId: string) => {
  memberViewer(db, workspaceId, teamId, accountId);
  return db.schedules.filter((item) => item.teamId === teamId && (!item.personal || item.createdBy === accountId));
};

const findSchedule = (db: MockDb, teamId: string, scheduleId: string, accountId: string) => {
  const schedule = db.schedules.find((item) => item.id === scheduleId && item.teamId === teamId);
  // 다른 사람의 개인 일정은 존재를 드러내지 않는다.
  if (!schedule || (schedule.personal && schedule.createdBy !== accountId)) throw new DataError('일정을 찾을 수 없어요.', 'NOT_FOUND');
  return schedule;
};

const cleanSchedule = (input: ScheduleInput) => ({
  title: input.title.trim(),
  description: input.description?.trim() || undefined,
  type: input.type,
  startAt: input.startAt,
  endAt: input.endAt,
  personal: input.personal,
});

export const createSchedule = (db: MockDb, workspaceId: string, teamId: string, accountId: string, input: ScheduleInput) => {
  memberViewer(db, workspaceId, teamId, accountId);
  invalid(validateSchedule(input));
  const schedule: Schedule = { id: newId('sc'), teamId, createdBy: accountId, ...cleanSchedule(input) };
  return { db: { ...db, schedules: [...db.schedules, schedule] }, scheduleId: schedule.id };
};

export const updateSchedule = (db: MockDb, workspaceId: string, teamId: string, accountId: string, scheduleId: string, input: ScheduleInput): MockDb => {
  const viewer = memberViewer(db, workspaceId, teamId, accountId);
  const schedule = findSchedule(db, teamId, scheduleId, accountId);
  if (!canEditSchedule(schedule, viewer)) throw new DataError('일정을 만든 사람과 팀장만 고칠 수 있어요.', 'FORBIDDEN');
  invalid(validateSchedule(input));
  // 남이 만든 팀 일정을 팀장이 개인 일정으로 바꾸면 만든 사람에게서 사라지므로 막는다.
  if (input.personal && schedule.createdBy !== accountId) throw new DataError('내가 만든 일정만 개인 일정으로 바꿀 수 있어요.', 'INVALID');
  return { ...db, schedules: db.schedules.map((item) => (item.id === scheduleId ? { ...item, ...cleanSchedule(input) } : item)) };
};

export const deleteSchedule = (db: MockDb, workspaceId: string, teamId: string, accountId: string, scheduleId: string): MockDb => {
  const viewer = memberViewer(db, workspaceId, teamId, accountId);
  const schedule = findSchedule(db, teamId, scheduleId, accountId);
  if (!canEditSchedule(schedule, viewer)) throw new DataError('일정을 만든 사람과 팀장만 지울 수 있어요.', 'FORBIDDEN');
  return { ...db, schedules: db.schedules.filter((item) => item.id !== scheduleId) };
};

/* ── 게시판 ── */

export const listPosts = (db: MockDb, workspaceId: string, teamId: string, accountId: string) => {
  memberViewer(db, workspaceId, teamId, accountId);
  return db.posts.filter((post) => post.teamId === teamId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const findPost = (db: MockDb, teamId: string, postId: string) => {
  const post = db.posts.find((item) => item.id === postId && item.teamId === teamId);
  if (!post) throw new DataError('글을 찾을 수 없어요. 삭제됐을 수 있어요.', 'NOT_FOUND');
  return post;
};

export const createPost = (db: MockDb, workspaceId: string, teamId: string, accountId: string, input: PostInput) => {
  memberViewer(db, workspaceId, teamId, accountId);
  invalid(validatePost(input));
  const post = { id: newId('p'), teamId, title: input.title.trim(), content: input.content.trim(), authorId: accountId, createdAt: now(), updatedAt: now(), comments: [] };
  return { db: { ...db, posts: [...db.posts, post] }, postId: post.id };
};

export const updatePost = (db: MockDb, workspaceId: string, teamId: string, accountId: string, postId: string, input: PostInput): MockDb => {
  const viewer = memberViewer(db, workspaceId, teamId, accountId);
  const post = findPost(db, teamId, postId);
  if (!canEditAuthored(post.authorId, viewer)) throw new DataError('글을 쓴 사람과 팀장만 고칠 수 있어요.', 'FORBIDDEN');
  invalid(validatePost(input));
  return { ...db, posts: db.posts.map((item) => (item.id === postId ? { ...item, title: input.title.trim(), content: input.content.trim(), updatedAt: now() } : item)) };
};

export const deletePost = (db: MockDb, workspaceId: string, teamId: string, accountId: string, postId: string): MockDb => {
  const viewer = memberViewer(db, workspaceId, teamId, accountId);
  const post = findPost(db, teamId, postId);
  if (!canEditAuthored(post.authorId, viewer)) throw new DataError('글을 쓴 사람과 팀장만 지울 수 있어요.', 'FORBIDDEN');
  return { ...db, posts: db.posts.filter((item) => item.id !== postId) };
};

export const addPostComment = (db: MockDb, workspaceId: string, teamId: string, accountId: string, postId: string, content: string): MockDb => {
  memberViewer(db, workspaceId, teamId, accountId);
  const post = findPost(db, teamId, postId);
  const text = content.trim();
  if (!text) throw new DataError('댓글을 입력해 주세요.', 'INVALID');
  if (text.length > POST_LIMITS.commentMax) throw new DataError(`댓글은 ${POST_LIMITS.commentMax}자까지 쓸 수 있어요.`, 'INVALID');
  const comment = { id: newId('pc'), authorId: accountId, content: text, createdAt: now() };
  return { ...db, posts: db.posts.map((item) => (item.id === post.id ? { ...item, comments: [...item.comments, comment] } : item)) };
};

export const deletePostComment = (db: MockDb, workspaceId: string, teamId: string, accountId: string, postId: string, commentId: string): MockDb => {
  const viewer = memberViewer(db, workspaceId, teamId, accountId);
  const post = findPost(db, teamId, postId);
  const comment = post.comments.find((item) => item.id === commentId);
  if (!comment) throw new DataError('댓글을 찾을 수 없어요.', 'NOT_FOUND');
  if (!canEditAuthored(comment.authorId, viewer)) throw new DataError('댓글을 쓴 사람과 팀장만 지울 수 있어요.', 'FORBIDDEN');
  return { ...db, posts: db.posts.map((item) => (item.id === post.id ? { ...item, comments: item.comments.filter((entry) => entry.id !== commentId) } : item)) };
};

/* ── 팀 공지 ── */

const toTeamAnnouncement = (item: MockDb['announcements'][number]): TeamAnnouncement => ({
  id: item.id,
  teamId: item.teamId!,
  title: item.title,
  content: item.content ?? '',
  authorId: item.authorId ?? '',
  authorName: item.authorName,
  createdAt: item.createdAt,
});

export const listTeamAnnouncements = (db: MockDb, workspaceId: string, teamId: string, accountId: string) => {
  memberViewer(db, workspaceId, teamId, accountId);
  return db.announcements.filter((item) => item.teamId === teamId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toTeamAnnouncement);
};

const requireLeader = (db: MockDb, workspaceId: string, teamId: string, accountId: string) => {
  if (!memberViewer(db, workspaceId, teamId, accountId).isLeader) throw new DataError('팀 공지는 팀장만 쓸 수 있어요.', 'FORBIDDEN');
};

const findAnnouncement = (db: MockDb, teamId: string, announcementId: string) => {
  const found = db.announcements.find((item) => item.id === announcementId && item.teamId === teamId);
  if (!found) throw new DataError('공지를 찾을 수 없어요.', 'NOT_FOUND');
  return found;
};

export const createAnnouncement = (db: MockDb, workspaceId: string, teamId: string, accountId: string, input: AnnouncementInput) => {
  requireLeader(db, workspaceId, teamId, accountId);
  invalid(validateAnnouncement(input));
  const team = db.teams.find((item) => item.id === teamId)!;
  const author = db.accounts.find((account) => account.id === accountId)!;
  const announcement = {
    id: newId('a'),
    workspaceId,
    teamId,
    teamName: team.name,
    title: input.title.trim(),
    content: input.content.trim(),
    authorId: accountId,
    authorName: author.name,
    createdAt: now(),
  };
  return { db: { ...db, announcements: [...db.announcements, announcement] }, announcementId: announcement.id };
};

export const updateAnnouncement = (db: MockDb, workspaceId: string, teamId: string, accountId: string, announcementId: string, input: AnnouncementInput): MockDb => {
  requireLeader(db, workspaceId, teamId, accountId);
  findAnnouncement(db, teamId, announcementId);
  invalid(validateAnnouncement(input));
  return {
    ...db,
    announcements: db.announcements.map((item) => (item.id === announcementId ? { ...item, title: input.title.trim(), content: input.content.trim() } : item)),
  };
};

export const deleteAnnouncement = (db: MockDb, workspaceId: string, teamId: string, accountId: string, announcementId: string): MockDb => {
  requireLeader(db, workspaceId, teamId, accountId);
  findAnnouncement(db, teamId, announcementId);
  return { ...db, announcements: db.announcements.filter((item) => item.id !== announcementId) };
};
