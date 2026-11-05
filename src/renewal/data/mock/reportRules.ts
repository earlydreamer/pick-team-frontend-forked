import { actionsFor, handledByWorkspace, isOpen, validateReport, workspaceActionsFor, type AdminReport, type ReportAction, type ReportHandler, type ReportInput, type ReportStatus } from '@/renewal/domain/report';
import { DataError } from '../ports';
import type { MockDb, MockReport } from './db';
import { membersOf } from './chatRules';
import { notify } from './notifyRules';
import { banBySystem, banMember } from './workspaceAdminRules';

/*
 * 신고 규칙(17 §4.1, §5.1, §5.2).
 *
 * | 행동 | 할 수 있는 사람 |
 * |---|---|
 * | 신고 제출 | 대상을 볼 수 있는 워크스페이스 멤버. 자기 자신과 자기 글은 신고할 수 없다 |
 * | 1차 검토·조치 | 그 워크스페이스의 개설자·매니저(17 §2). 기각, 경고, 콘텐츠 삭제, 워크스페이스 차단 |
 * | 운영자에게 넘기기 | 개설자·매니저. 넘긴 뒤에는 시스템 관리자만 처리한다 |
 * | 모든 검토·조치 | 시스템 관리자(UserRole.ADMIN). 계정 정지는 시스템 관리자만 한다 |
 *
 * 관할 구분(17 §2): 운영진(개설자·매니저)이 대상인 신고는 접수 때 바로 시스템 관리자에게 넘긴다.
 * 운영진은 자기가 신고했거나 자기가 대상인 신고를 보지 않는다.
 * 신고자 보호: 피신고자에게 가는 알림에는 신고자를 담지 않고, 신고자에게는 결과만 알린다. 운영진 화면에도 신고자를 담지 않는다.
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

/** 워크스페이스 운영진(개설자·매니저) */
const staffOf = (db: MockDb, workspaceId: string) =>
  db.workspaces.find((item) => item.id === workspaceId)?.members.filter((member) => member.role !== 'MEMBER').map((member) => member.accountId) ?? [];

/** 운영자에게 넘어온 신고를 시스템 관리자에게 알린다. 운영자 콘솔의 접수 목록으로 잇고, 읽기 전까지 묶는다 */
const notifyAdmins = (db: MockDb, workspaceId: string): MockDb =>
  notify(
    db,
    db.accounts.filter((account) => account.systemRole === 'ADMIN').map((account) => account.id),
    {
      type: 'REPORT_RECEIVED',
      workspaceId,
      link: '/admin/reports?status=RECEIVED',
      title: '운영자가 처리할 신고가 넘어왔어요.',
      group: { key: 'report:system', title: (count) => `운영자가 처리할 신고가 ${count}건 넘어왔어요.` },
    },
    SYSTEM,
  );

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
  if (input.targetType === 'COMMENT') {
    const post = db.posts.find((item) => item.comments.some((comment) => comment.id === input.targetId));
    const comment = post?.comments.find((item) => item.id === input.targetId);
    const team = post && db.teams.find((item) => item.id === post.teamId && item.workspaceId === input.workspaceId);
    if (!post || !comment || !team || !team.memberIds.includes(reporterId)) throw missing;
    // 댓글만으로는 맥락이 부족해 어느 글의 댓글인지 함께 남긴다.
    return { targetAccountId: comment.authorId, snapshot: `${comment.content}\n(글: ${post.title})` };
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
  const staff = staffOf(db, input.workspaceId);
  if (staff.includes(targetAccountId)) return notifyAdmins({ ...db, reports: [...db.reports, { ...report, escalation: 'STAFF_TARGET', escalatedAt: report.createdAt }] }, input.workspaceId);
  const next = { ...db, reports: [...db.reports, report] };
  return notify(
    next,
    staff.filter((id) => id !== reporterId),
    {
      type: 'REPORT_RECEIVED',
      workspaceId: input.workspaceId,
      link: `/ws/${input.workspaceId}/settings?tab=reports`,
      title: '새 신고가 접수됐어요. 확인해 주세요.',
      // 처리하기 전에 여러 건이 오면 한 건으로 묶는다(16 §6.3과 같은 방식).
      group: { key: `report:${input.workspaceId}`, title: (count) => `새 신고가 ${count}건 접수됐어요. 확인해 주세요.` },
    },
    SYSTEM,
  );
};

const targetExists = (db: MockDb, report: MockReport) =>
  report.targetType === 'USER'
    ? Boolean(db.workspaces.find((item) => item.id === report.workspaceId)?.members.some((member) => member.accountId === report.targetId))
    : report.targetType === 'MESSAGE'
      ? db.chatMessages.some((item) => item.id === report.targetId)
      : report.targetType === 'COMMENT'
        ? db.posts.some((post) => post.comments.some((item) => item.id === report.targetId))
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
  escalation: report.escalation,
  handledBy: report.handledBy,
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

const begin = (db: MockDb, report: MockReport): MockDb => {
  if (report.status !== 'RECEIVED') throw new DataError('이미 검토를 시작했거나 처리한 신고예요.', 'CONFLICT');
  return replaceReport(db, report.id, { status: 'REVIEWING' });
};

export const startReview = (db: MockDb, adminId: string, id: string): MockDb => {
  requireSystemAdmin(db, adminId);
  return begin(db, findReport(db, id));
};

const MODERATION_LINK = '/me';

/**
 * 조치(17 §5.1). 검토 중인 신고만 처리한다. 시스템 관리자와 워크스페이스 운영진이 같은 흐름을 쓴다.
 * 피신고자 알림은 조치 내용만, 신고자 알림은 처리 결과만 담는다.
 */
const applyAction = (db: MockDb, report: MockReport, action: ReportAction, memo: string | undefined, handler: { by: ReportHandler; actorId: string }): MockDb => {
  if (report.status !== 'REVIEWING') throw new DataError('검토를 시작한 신고만 처리할 수 있어요.', 'CONFLICT');
  const allowed = handler.by === 'SYSTEM' ? actionsFor(report.targetType) : workspaceActionsFor(report.targetType);
  if (!allowed.includes(action)) throw new DataError('이 신고에는 쓸 수 없는 조치예요.', 'INVALID');
  const id = report.id;
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
        : report.targetType === 'COMMENT'
          ? { ...next, posts: next.posts.map((post) => ({ ...post, comments: post.comments.filter((item) => item.id !== report.targetId) })) }
          : { ...next, posts: next.posts.filter((item) => item.id !== report.targetId) };
    next = notify(next, [target], { type: 'MODERATION_NOTICE', workspaceId, link: MODERATION_LINK, title: '작성한 콘텐츠가 운영 정책에 따라 삭제됐어요.' }, SYSTEM);
  } else if (action === 'BANNED_WS') {
    // 운영진은 멤버 관리의 차단과 같은 권한 검사를 거친다. 이미 떠난 사람은 다시 합류하지 못하게 기록만 남긴다.
    const member = next.workspaces.find((item) => item.id === workspaceId)?.members.some((entry) => entry.accountId === target);
    if (handler.by === 'SYSTEM') next = banBySystem(next, workspaceId, target).db;
    else if (member) next = banMember(next, workspaceId, handler.actorId, target).db;
    else if (!next.bans.some((ban) => ban.workspaceId === workspaceId && ban.accountId === target)) next = { ...next, bans: [...next.bans, { workspaceId, accountId: target, bannedAt: now() }] };
    const workspace = next.workspaces.find((item) => item.id === workspaceId);
    next = notify(next, [target], { type: 'WS_MEMBER_BANNED', workspaceId, link: '/welcome', title: `${workspace?.name ?? '워크스페이스'}에서 차단됐어요. 더 이상 참여할 수 없어요.` }, SYSTEM);
  } else if (action === 'BANNED_SYSTEM') {
    next = { ...next, accounts: next.accounts.map((account) => (account.id === target ? { ...account, suspendedAt: now() } : account)) };
  }

  const dismissed = action === 'DISMISS';
  next = replaceReport(next, id, {
    status: dismissed ? 'DISMISSED' : 'ACTED',
    action: dismissed ? undefined : action,
    adminMemo: memo?.trim() || report.adminMemo,
    resolvedAt: now(),
    handledBy: handler.by,
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

export const resolveReport = (db: MockDb, adminId: string, id: string, action: ReportAction, memo?: string): MockDb => {
  requireSystemAdmin(db, adminId);
  return applyAction(db, findReport(db, id), action, memo, { by: 'SYSTEM', actorId: adminId });
};

/* 워크스페이스 운영진의 1차 처리(17 §2, §5.2) */

const requireStaff = (db: MockDb, workspaceId: string, actorId: string) => {
  if (!staffOf(db, workspaceId).includes(actorId)) throw new DataError('워크스페이스 운영진만 볼 수 있어요.', 'FORBIDDEN');
};

/** 운영진에게 보이는 신고. 운영진 대상으로 넘어간 신고, 내가 신고했거나 내가 대상인 신고는 뺀다 */
const visibleToStaff = (report: MockReport, workspaceId: string, actorId: string) =>
  report.workspaceId === workspaceId && report.escalation !== 'STAFF_TARGET' && report.reporterId !== actorId && report.targetAccountId !== actorId;

export const listWorkspaceReports = (db: MockDb, actorId: string, workspaceId: string) => {
  requireStaff(db, workspaceId, actorId);
  return db.reports
    .filter((report) => visibleToStaff(report, workspaceId, actorId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    // 운영자가 처리한 신고의 메모는 운영자만 본다.
    .map((report) => ({ ...toAdminReport(db, report), adminMemo: report.handledBy === 'SYSTEM' ? undefined : report.adminMemo }));
};

/** 운영진이 처리할 수 있는 신고를 찾는다. 볼 수 없는 신고는 NOT_FOUND로 숨긴다 */
const findForStaff = (db: MockDb, actorId: string, workspaceId: string, id: string) => {
  requireStaff(db, workspaceId, actorId);
  const report = db.reports.find((item) => item.id === id);
  if (!report || !visibleToStaff(report, workspaceId, actorId)) throw new DataError('신고를 찾을 수 없어요.', 'NOT_FOUND');
  if (report.escalation) throw new DataError('운영자에게 넘긴 신고예요. 운영자가 처리해요.', 'CONFLICT');
  return report;
};

export const startWorkspaceReview = (db: MockDb, actorId: string, workspaceId: string, id: string): MockDb => begin(db, findForStaff(db, actorId, workspaceId, id));

export const resolveInWorkspace = (db: MockDb, actorId: string, workspaceId: string, id: string, action: ReportAction, memo?: string): MockDb =>
  applyAction(db, findForStaff(db, actorId, workspaceId, id), action, memo, { by: 'WORKSPACE', actorId });

/** 운영자에게 넘긴다. 계정 정지가 필요하거나 판단이 어려울 때 쓴다. 메모는 운영자가 읽는다 */
export const escalateReport = (db: MockDb, actorId: string, workspaceId: string, id: string, memo?: string): MockDb => {
  const report = findForStaff(db, actorId, workspaceId, id);
  if (!handledByWorkspace(report)) throw new DataError('처리가 끝난 신고예요.', 'CONFLICT');
  return notifyAdmins(replaceReport(db, id, { escalation: 'MANAGER', escalatedAt: now(), adminMemo: memo?.trim() || report.adminMemo }), workspaceId);
};

/** 운영진 설정 탭의 배지. 지금 처리할 신고 수 */
export const openWorkspaceReportCount = (db: MockDb, actorId: string, workspaceId: string) =>
  staffOf(db, workspaceId).includes(actorId) ? db.reports.filter((report) => visibleToStaff(report, workspaceId, actorId) && handledByWorkspace(report)).length : 0;
