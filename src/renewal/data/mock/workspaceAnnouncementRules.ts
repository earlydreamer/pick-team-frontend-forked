import { validateAnnouncement, type AnnouncementInput, type TeamAnnouncement } from '@/renewal/domain/collab';
import { isManager } from '@/renewal/domain/workspace';
import { DataError } from '../ports';
import type { MockDb } from './db';

/*
 * 워크스페이스 공지(02 §2.3 내비 "공지", 16 §5.4 ANNOUNCEMENT_CREATED의 SCR-WS-01 착지).
 * 팀 공지와 같은 저장소(announcements)를 쓰고 teamId가 없는 항목이 워크스페이스 전체 공지다.
 * 멤버는 모두 읽고, 개설자·매니저만 쓰고 고치고 지운다.
 */

const now = () => new Date().toISOString();
let sequence = 0;
const newId = () => `wa-${Date.now().toString(36)}${(sequence++).toString(36)}`;

const roleOf = (db: MockDb, workspaceId: string, accountId: string) => {
  const member = db.workspaces.find((workspace) => workspace.id === workspaceId)?.members.find((item) => item.accountId === accountId);
  if (!member) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  return member.role;
};

const requireManager = (db: MockDb, workspaceId: string, accountId: string) => {
  if (!isManager(roleOf(db, workspaceId, accountId))) throw new DataError('워크스페이스 공지는 개설자와 매니저만 쓸 수 있어요.', 'FORBIDDEN');
};

const requireValid = (input: AnnouncementInput) => {
  const first = Object.values(validateAnnouncement(input)).find(Boolean);
  if (first) throw new DataError(first, 'INVALID');
};

const findOne = (db: MockDb, workspaceId: string, announcementId: string) => {
  const found = db.announcements.find((item) => item.id === announcementId && item.workspaceId === workspaceId && !item.teamId);
  if (!found) throw new DataError('공지를 찾을 수 없어요. 지워졌을 수 있어요.', 'NOT_FOUND');
  return found;
};

/** 화면 모델은 팀 공지와 같은 모양을 쓴다. teamId는 비워 둔다 */
const toView = (item: MockDb['announcements'][number]): TeamAnnouncement => ({
  id: item.id,
  teamId: '',
  title: item.title,
  content: item.content ?? '',
  authorId: item.authorId ?? '',
  authorName: item.authorName,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const listWorkspaceAnnouncements = (db: MockDb, workspaceId: string, accountId: string) => {
  roleOf(db, workspaceId, accountId);
  return db.announcements
    .filter((item) => item.workspaceId === workspaceId && !item.teamId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toView);
};

export const createWorkspaceAnnouncement = (db: MockDb, workspaceId: string, accountId: string, input: AnnouncementInput) => {
  requireManager(db, workspaceId, accountId);
  requireValid(input);
  const author = db.accounts.find((account) => account.id === accountId)!;
  const announcement = { id: newId(), workspaceId, title: input.title.trim(), content: input.content.trim(), authorId: accountId, authorName: author.name, createdAt: now() };
  return { db: { ...db, announcements: [...db.announcements, announcement] }, announcementId: announcement.id };
};

export const updateWorkspaceAnnouncement = (db: MockDb, workspaceId: string, accountId: string, announcementId: string, input: AnnouncementInput): MockDb => {
  requireManager(db, workspaceId, accountId);
  findOne(db, workspaceId, announcementId);
  requireValid(input);
  return {
    ...db,
    announcements: db.announcements.map((item) => (item.id === announcementId ? { ...item, title: input.title.trim(), content: input.content.trim(), updatedAt: now() } : item)),
  };
};

export const deleteWorkspaceAnnouncement = (db: MockDb, workspaceId: string, accountId: string, announcementId: string): MockDb => {
  requireManager(db, workspaceId, accountId);
  findOne(db, workspaceId, announcementId);
  return { ...db, announcements: db.announcements.filter((item) => item.id !== announcementId) };
};
