/**
 * 일정·게시판·팀 공지 도메인. 근거: docs/renewal/spec/14-collab-tools.md §2, §4.3~§4.5, §5.3.
 *
 * | 대상 | 수정·삭제할 수 있는 사람 |
 * |---|---|
 * | 팀 일정 | 만든 사람, 팀장 |
 * | 개인 일정 | 만든 사람(다른 사람에게는 보이지도 않는다) |
 * | 게시글·댓글 | 쓴 사람, 팀장 |
 * | 팀 공지 | 팀장 |
 */

import type { Schedule, ScheduleType } from './teamSpace';

export interface CollabViewer {
  accountId: string;
  isLeader: boolean;
}

/* ── 일정 ── */

export const SCHEDULE_LIMITS = { titleMax: 100, descriptionMax: 500 } as const;

export interface ScheduleInput {
  title: string;
  description?: string;
  type: ScheduleType;
  startAt: string;
  endAt: string;
  personal: boolean;
}

export const validateSchedule = (input: ScheduleInput) => {
  const errors: Partial<Record<keyof ScheduleInput, string>> = {};
  const title = input.title.trim();
  if (!title) errors.title = '일정 이름을 입력해 주세요.';
  else if (title.length > SCHEDULE_LIMITS.titleMax) errors.title = `일정 이름은 ${SCHEDULE_LIMITS.titleMax}자까지 쓸 수 있어요.`;
  if ((input.description ?? '').length > SCHEDULE_LIMITS.descriptionMax) errors.description = `설명은 ${SCHEDULE_LIMITS.descriptionMax}자까지 쓸 수 있어요.`;
  const start = new Date(input.startAt).getTime();
  const end = new Date(input.endAt).getTime();
  if (Number.isNaN(start)) errors.startAt = '시작 일시를 입력해 주세요.';
  if (Number.isNaN(end)) errors.endAt = '끝나는 일시를 입력해 주세요.';
  else if (!Number.isNaN(start) && end < start) errors.endAt = '끝나는 일시는 시작 일시보다 뒤여야 해요.';
  return errors;
};

export const canEditSchedule = (schedule: Pick<Schedule, 'createdBy' | 'personal'>, viewer: CollabViewer) =>
  schedule.createdBy === viewer.accountId || (!schedule.personal && viewer.isLeader);

/** 로컬 날짜 키 YYYY-MM-DD */
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** 월간 달력 칸. 일요일부터 시작하는 주 단위로, 앞뒤 달의 날짜로 채운다. */
export const monthGrid = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const lastOfMonth = new Date(year, month + 1, 0);
  const weeks = Math.ceil((first.getDay() + lastOfMonth.getDate()) / 7);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day)),
  );
};

/** 기준 날짜가 속한 주(일~토) */
export const weekDays = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
};

/** 일정이 그 날짜에 걸쳐 있는지(여러 날 일정은 걸친 날마다 보인다) */
export const occursOn = (schedule: Pick<Schedule, 'startAt' | 'endAt'>, day: Date) => {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + 86_400_000;
  return new Date(schedule.startAt).getTime() < dayEnd && new Date(schedule.endAt).getTime() >= dayStart;
};

/* ── 게시판 ── */

export const POST_LIMITS = { titleMax: 100, contentMax: 5000, commentMax: 500 } as const;

export interface PostComment {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  teamId: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  comments: PostComment[];
}

export interface PostInput {
  title: string;
  content: string;
}

export const validatePost = (input: PostInput) => {
  const errors: Partial<Record<keyof PostInput, string>> = {};
  if (!input.title.trim()) errors.title = '제목을 입력해 주세요.';
  else if (input.title.trim().length > POST_LIMITS.titleMax) errors.title = `제목은 ${POST_LIMITS.titleMax}자까지 쓸 수 있어요.`;
  if (!input.content.trim()) errors.content = '내용을 입력해 주세요.';
  else if (input.content.length > POST_LIMITS.contentMax) errors.content = `내용은 ${POST_LIMITS.contentMax}자까지 쓸 수 있어요.`;
  return errors;
};

export const canEditAuthored = (authorId: string, viewer: CollabViewer) => authorId === viewer.accountId || viewer.isLeader;

/* ── 팀 공지 ── */

export const ANNOUNCEMENT_LIMITS = { titleMax: 100, contentMax: 2000 } as const;

export interface TeamAnnouncement {
  id: string;
  teamId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AnnouncementInput {
  title: string;
  content: string;
}

export const validateAnnouncement = (input: AnnouncementInput) => {
  const errors: Partial<Record<keyof AnnouncementInput, string>> = {};
  if (!input.title.trim()) errors.title = '제목을 입력해 주세요.';
  else if (input.title.trim().length > ANNOUNCEMENT_LIMITS.titleMax) errors.title = `제목은 ${ANNOUNCEMENT_LIMITS.titleMax}자까지 쓸 수 있어요.`;
  if (!input.content.trim()) errors.content = '내용을 입력해 주세요.';
  else if (input.content.length > ANNOUNCEMENT_LIMITS.contentMax) errors.content = `내용은 ${ANNOUNCEMENT_LIMITS.contentMax}자까지 쓸 수 있어요.`;
  return errors;
};
