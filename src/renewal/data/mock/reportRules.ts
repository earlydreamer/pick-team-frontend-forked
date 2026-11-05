import { actionsFor, isOpen, validateReport, type AdminReport, type ReportAction, type ReportInput, type ReportStatus } from '@/renewal/domain/report';
import { DataError } from '../ports';
import type { MockDb, MockReport } from './db';
import { membersOf } from './chatRules';
import { notify } from './notifyRules';
import { banBySystem } from './workspaceAdminRules';

/*
 * 신고 규칙(17 §4.1, §5.1, §5.2).
 *
 * | 행동 | 할 수 있는 사람 |
 * |---|---|
 * | 신고 제출 | 대상을 볼 수 있는 워크스페이스 멤버. 자기 자신과 자기 글은 신고할 수 없다 |
 * | 검토·조치 | 시스템 관리자(UserRole.ADMIN) |
 *
 * 신고자 보호: 피신고자에게 가는 알림에는 신고자를 담지 않고, 신고자에게는 결과만 알린다.
 */

const now = () => new Date().toISOString();
let sequence = 0;
const newId = () => `rp-${Date.now().toString(36)}${(sequence++).toString(36)}`;
const SYSTEM = 'system';

const accountOf = (db: MockDb, id: string) => db.accounts.find((account) => account.id === id);

const requireMember = (db: MockDb, workspaceId: string, accountId: string) => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  if (!workspace?.members.some((member) => member.accountId === accountId)) throw new DataError('워크스페이스를 찾을 수 없어요.', 'NOT_FOUND');
  return workspace;
};

export const requireSystemAdmin = (db: MockDb, accountId: string) => {
  if (accountOf(db, accountId)?.systemRole !== 'ADMIN') throw new DataError('시스템 관리자만 볼 수 있어요.', 'FORBIDDEN');
};

/** 신고 대상을 찾아 작성자와 원문을 돌려준다. 볼 수 없는 대상은 NOT_FOUND로 숨긴다 */
const resolveTarget = (db: MockDb, reporterId: string, input: ReportInput): { targetAccountId: string; snapshot: string } => {
  const workspace = requireMember(db, input.workspaceId, reporterId);
  const missing = new DataError('신고할 대상을 찾을 수 없어요.', 'NOT_FOUND');
  if (input.targetType === 'USER') {
    if (!workspace.members.some((member) => member.accountId === input.targetId)) throw missing;
    const card = db.cards[input.targetId];
    const name = accountOf(db, input.targetId)?.name ?? '알 수 없음';
    return { targetAccountId: input.targetId, snapshot: card?.introduction ? `${name}: ${card.introduction}` : `${name}의 프로필` };
  }
  if (input.targetType === 'MESSAGE') {
    const message = db.chatMessages.find((item) => item.id === input.targetId);
    const room = message && db.chatRooms.find((item) => item.id === message.roomId && item.workspaceId === input.workspaceId);
    if (!message || !room || !message.authorId || !membersOf(db, room).includes(reporterId)) throw missing;
    return { targetAccountId: message.authorId, snapshot: message.content };
  }
  const post = db.posts.find((item) => item.id === input.targetId);
  const team = post && db.teams.find((item) => item.id === post.teamId && item.workspaceId === input.workspaceId);
  if (!post || !team || !team.memberIds.includes(reporterId)) throw missing;
  return { targetAccountId: post.authorId, snapshot: `${post.title}\n${post.content}` };
};

export const submitReport = (db: MockDb, reporterId: string, input: ReportInput): MockDb => {
  const error = validateReport(input);
  if (error) throw new DataError(error, 'INVALID');
  const { targetAccountId, snapshot } = resolveTarget(db, reporterId, input);
  if (targetAccountId === reporterId) throw new DataError('내 프로필이나 내가 쓴 글은 신고할 수 없어요.', 'INVALID');
  if (db.reports.some((report) => report.reporterId === reporterId && report.targetType === input.targetType && report.targetId === input.targetId && isOpen(report.status))) {
    throw new DataError('이미 신고했어요. 검토가 끝나면 알려 드릴게요.', 'CONFLICT');
  }
  const report: MockReport = {
    id: newId(),
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    workspaceId: input.workspaceId,
    targetAccountId,
    snapshot,
    reason: input.reason,
    detail: input.detail?.trim() || undefined,
    status: 'RECEIVED',
    createdAt: now(),
  };
  return { ...db, reports: [...db.reports, report] };
};

const targetExists = (db: MockDb, report: MockReport) =>
  report.targetType === 'USER'
    ? Boolean(db.workspaces.find((item) => item.id === report.workspaceId)?.members.some((member) => member.accountId === report.targetId))
    : report.targetType === 'MESSAGE'
      ? db.chatMessages.some((item) => item.id === report.targetId)
      : db.posts.some((item) => item.id === report.targetId);

/** 관리자 화면 모델. 신고자 id는 담지 않는다 */
export const toAdminReport = (db: MockDb, report: MockReport): AdminReport => ({
  id: report.id,
  targetType: report.targetType,
  targetId: report.targetId,
  workspaceId: report.workspaceId,
  workspaceName: db.workspaces.find((item) => item.id === report.workspaceId)?.name ?? '삭제된 워크스페이스',
  targetAccount: { id: report.targetAccountId, name: accountOf(db, report.targetAccountId)?.name ?? '알 수 없음' },
  snapshot: report.snapshot,
  reason: report.reason,
  detail: report.detail,
  status: report.status,
  action: report.action,
  adminMemo: report.adminMemo,
  createdAt: report.createdAt,
  resolvedAt: report.resolvedAt,
  targetExists: targetExists(db, report),
});

export const listReports = (db: MockDb, adminId: string, status?: ReportStatus) => {
  requireSystemAdmin(db, adminId);
  return db.reports
    .filter((report) => !status || report.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((report) => toAdminReport(db, report));
};

const findReport = (db: MockDb, id: string) => {
  const report = db.reports.find((item) => item.id === id);
  if (!report) throw new DataError('신고를 찾을 수 없어요.', 'NOT_FOUND');
  return report;
};

const replaceReport = (db: MockDb, id: string, patch: Partial<MockReport>): MockDb => ({ ...db, reports: db.reports.map((item) => (item.id === id ? { ...item, ...patch } : item)) });

export const startReview = (db: MockDb, adminId: string, id: string): MockDb => {
  requireSystemAdmin(db, adminId);
  const report = findReport(db, id);
  if (report.status !== 'RECEIVED') throw new DataError('이미 검토를 시작했거나 처리한 신고예요.', 'CONFLICT');
  return replaceReport(db, id, { status: 'REVIEWING' });
};

const MODERATION_LINK = '/me';

/**
 * 조치(17 §5.1). 검토 중인 신고만 처리한다.
 * 피신고자 알림은 조치 내용만, 신고자 알림은 처리 결과만 담는다.
 */
export const resolveReport = (db: MockDb, adminId: string, id: string, action: ReportAction, memo?: string): MockDb => {
  requireSystemAdmin(db, adminId);
  const report = findReport(db, id);
  if (report.status !== 'REVIEWING') throw new DataError('검토를 시작한 신고만 처리할 수 있어요.', 'CONFLICT');
  if (!actionsFor(report.targetType).includes(action)) throw new DataError('이 신고에는 쓸 수 없는 조치예요.', 'INVALID');
  const workspaceId = report.workspaceId;
  const target = report.targetAccountId;
  let next = db;

  if (action === 'WARNED') {
    next = notify(next, [target], { type: 'MODERATION_NOTICE', workspaceId, link: MODERATION_LINK, title: '운영 정책 위반으로 경고를 받았어요. 같은 일이 반복되면 이용이 제한될 수 있어요.' }, SYSTEM);
  } else if (action === 'CONTENT_REMOVED') {
    if (!targetExists(next, report)) throw new DataError('이미 지워진 콘텐츠예요. 다른 조치를 골라 주세요.', 'GONE');
    next =
      report.targetType === 'MESSAGE'
        ? { ...next, chatMessages: next.chatMessages.filter((item) => item.id !== report.targetId) }
        : { ...next, posts: next.posts.filter((item) => item.id !== report.targetId) };
    next = notify(next, [target], { type: 'MODERATION_NOTICE', workspaceId, link: MODERATION_LINK, title: '작성한 콘텐츠가 운영 정책에 따라 삭제됐어요.' }, SYSTEM);
  } else if (action === 'BANNED_WS') {
    next = banBySystem(next, workspaceId, target).db;
    const workspace = next.workspaces.find((item) => item.id === workspaceId);
    next = notify(next, [target], { type: 'WS_MEMBER_BANNED', workspaceId, link: '/welcome', title: `${workspace?.name ?? '워크스페이스'}에서 차단됐어요. 더 이상 참여할 수 없어요.` }, SYSTEM);
  } else if (action === 'BANNED_SYSTEM') {
    next = { ...next, accounts: next.accounts.map((account) => (account.id === target ? { ...account, suspendedAt: now() } : account)) };
  }

  const dismissed = action === 'DISMISS';
  next = replaceReport(next, id, {
    status: dismissed ? 'DISMISSED' : 'ACTED',
    action: dismissed ? undefined : action,
    adminMemo: memo?.trim() || undefined,
    resolvedAt: now(),
  });
  return notify(
    next,
    [report.reporterId],
    {
      type: 'REPORT_RESOLVED',
      workspaceId,
      link: '/notifications',
      title: dismissed ? '신고하신 내용을 검토했어요. 정책 위반은 확인되지 않았어요.' : '신고하신 내용이 처리되었어요.',
    },
    SYSTEM,
  );
};
