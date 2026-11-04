import { TASK_LIMITS, availableActions, validateTask, type KanbanTask, type TaskAction, type TaskInput, type TaskViewer } from '@/renewal/domain/kanban';
import { isManager } from '@/renewal/domain/workspace';
import { activeDelegation, type TeamSpaceAccess } from '@/renewal/domain/teamSpace';
import { DataError } from '../ports';
import type { MockDb } from './db';

/*
 * 팀 스페이스 접근과 칸반 규칙(14 §2, §4.2, §5.2). 화면의 버튼 목록과 같은 availableActions로 권한을 검사한다.
 */

const now = () => new Date().toISOString();
let sequence = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(sequence++).toString(36)}`;

/**
 * 팀 스페이스 자격. 팀원이 아니고 매니저도 아니면 팀의 존재를 숨긴다(02-D2 비공개 자원은 404).
 * 팀원이 아닌 매니저는 13-D1에 따라 집계와 칸반 승인만 볼 수 있다.
 */
export const teamAccess = (db: MockDb, workspaceId: string, teamId: string, accountId: string): TeamSpaceAccess => {
  const workspace = db.workspaces.find((item) => item.id === workspaceId);
  const membership = workspace?.members.find((member) => member.accountId === accountId);
  const team = db.teams.find((item) => item.id === teamId && item.workspaceId === workspaceId);
  if (!workspace || !membership || !team) throw new DataError('팀을 찾을 수 없어요.', 'NOT_FOUND');
  const isMember = team.memberIds.includes(accountId);
  if (!isMember && !isManager(membership.role)) throw new DataError('팀을 찾을 수 없어요.', 'NOT_FOUND');
  return { isMember, isLeader: team.leaderId === accountId, isManagerViewer: !isMember && isManager(membership.role) };
};

const requireMember = (access: TeamSpaceAccess) => {
  if (!access.isMember) throw new DataError('팀원만 할 수 있어요.', 'FORBIDDEN');
};

const viewerOf = (db: MockDb, workspaceId: string, teamId: string, accountId: string): TaskViewer => {
  const access = teamAccess(db, workspaceId, teamId, accountId);
  const role = db.workspaces.find((item) => item.id === workspaceId)!.members.find((member) => member.accountId === accountId)!.role;
  return { accountId, isMember: access.isMember, isLeader: access.isLeader, isManager: isManager(role) };
};

const findTask = (db: MockDb, teamId: string, taskId: string) => {
  const task = db.tasks.find((item) => item.id === taskId && item.teamId === teamId);
  if (!task) throw new DataError('태스크를 찾을 수 없어요. 다른 팀원이 삭제했을 수 있어요.', 'NOT_FOUND');
  return task;
};

const replaceTask = (db: MockDb, task: KanbanTask): MockDb => ({ ...db, tasks: db.tasks.map((item) => (item.id === task.id ? task : item)) });

/** 담당자는 팀원이어야 한다(14 §4.2 담당자 배정 실패는 조용히 넘기지 않고 알린다). */
const checkInput = (db: MockDb, teamId: string, input: TaskInput) => {
  const errors = validateTask(input);
  const first = Object.values(errors).find(Boolean);
  if (first) throw new DataError(first, 'INVALID');
  const team = db.teams.find((item) => item.id === teamId)!;
  if (input.assigneeIds.some((id) => !team.memberIds.includes(id))) throw new DataError('담당자가 팀원 목록에 없어요. 다시 배정해 주세요.', 'INVALID');
};

const clean = (input: TaskInput) => ({
  title: input.title.trim(),
  content: input.content?.trim() || undefined,
  deadline: input.deadline || undefined,
  assigneeIds: [...new Set(input.assigneeIds)],
});

export const createTask = (db: MockDb, workspaceId: string, teamId: string, accountId: string, input: TaskInput) => {
  requireMember(teamAccess(db, workspaceId, teamId, accountId));
  checkInput(db, teamId, input);
  const task: KanbanTask = { id: newId('k'), teamId, status: 'TODO', createdBy: accountId, createdAt: now(), updatedAt: now(), comments: [], ...clean(input) };
  return { db: { ...db, tasks: [...db.tasks, task] }, taskId: task.id };
};

export const updateTask = (db: MockDb, workspaceId: string, teamId: string, accountId: string, taskId: string, input: TaskInput): MockDb => {
  requireMember(teamAccess(db, workspaceId, teamId, accountId));
  const task = findTask(db, teamId, taskId);
  checkInput(db, teamId, input);
  return replaceTask(db, { ...task, ...clean(input), updatedAt: now() });
};

/** 만든 사람과 팀장만 지울 수 있다. */
export const deleteTask = (db: MockDb, workspaceId: string, teamId: string, accountId: string, taskId: string): MockDb => {
  const access = teamAccess(db, workspaceId, teamId, accountId);
  requireMember(access);
  const task = findTask(db, teamId, taskId);
  if (task.createdBy !== accountId && !access.isLeader) throw new DataError('태스크를 만든 사람과 팀장만 삭제할 수 있어요.', 'FORBIDDEN');
  return { ...db, tasks: db.tasks.filter((item) => item.id !== taskId) };
};

/**
 * 상태 전이. note는 완료 요청 메시지 또는 반려 사유다.
 * 완료 요청은 담당자만 할 수 있고, 담당자가 없으면 먼저 배정하라고 알린다(14 §5.2).
 */
export const transition = (db: MockDb, workspaceId: string, teamId: string, accountId: string, taskId: string, action: TaskAction, note?: string): MockDb => {
  const viewer = viewerOf(db, workspaceId, teamId, accountId);
  const task = findTask(db, teamId, taskId);
  const message = note?.trim();
  if (action === 'request') {
    if (task.status === 'IN_PROGRESS' && task.assigneeIds.length === 0) throw new DataError('담당자를 먼저 배정해야 완료 요청을 할 수 있어요.', 'INVALID');
    if (task.status === 'IN_PROGRESS' && viewer.isMember && !task.assigneeIds.includes(accountId)) throw new DataError('담당자만 완료 요청을 할 수 있어요.', 'FORBIDDEN');
  }
  // 팀장 위임이 진행 중이면 팀장의 승인·반려를 보류한다. 매니저 개입은 받는다(14 §5.2 승인자 부재).
  if ((action === 'approve' || action === 'reject') && viewer.isLeader && !viewer.isManager && activeDelegation(db.teams.find((team) => team.id === teamId)!)) {
    throw new DataError('팀장 위임이 진행 중이라 승인을 잠시 보류해요. 위임이 끝난 뒤 처리해 주세요.', 'CONFLICT');
  }
  if (!availableActions(task, viewer).includes(action)) {
    throw new DataError(viewer.isMember || viewer.isManager ? '지금 상태에서는 할 수 없는 작업이에요. 새로 고침해 주세요.' : '권한이 없어요.', 'CONFLICT');
  }
  if (message && message.length > TASK_LIMITS.messageMax) throw new DataError(`메시지는 ${TASK_LIMITS.messageMax}자까지 쓸 수 있어요.`, 'INVALID');
  const base = { ...task, updatedAt: now() };
  switch (action) {
    case 'start':
      return replaceTask(db, { ...base, status: 'IN_PROGRESS' });
    case 'back':
      return replaceTask(db, { ...base, status: 'TODO' });
    case 'request':
      return replaceTask(db, { ...base, status: 'APPROVAL_PENDING', completionRequestMessage: message, completionRequestedBy: accountId, completionRequestedAt: now(), rejectedReason: undefined });
    case 'approve':
      return replaceTask(db, { ...base, status: 'DONE', approvedBy: accountId, approvedAt: now() });
    case 'reject':
      if (!message) throw new DataError('반려 사유를 입력해 주세요.', 'INVALID');
      return replaceTask(db, { ...base, status: 'IN_PROGRESS', rejectedReason: message, completionRequestMessage: undefined, completionRequestedAt: undefined, completionRequestedBy: undefined });
    case 'reopen':
      return replaceTask(db, { ...base, status: 'IN_PROGRESS', approvedBy: undefined, approvedAt: undefined });
  }
};

export const addComment = (db: MockDb, workspaceId: string, teamId: string, accountId: string, taskId: string, content: string): MockDb => {
  requireMember(teamAccess(db, workspaceId, teamId, accountId));
  const task = findTask(db, teamId, taskId);
  const text = content.trim();
  if (!text) throw new DataError('댓글을 입력해 주세요.', 'INVALID');
  if (text.length > TASK_LIMITS.commentMax) throw new DataError(`댓글은 ${TASK_LIMITS.commentMax}자까지 쓸 수 있어요.`, 'INVALID');
  return replaceTask(db, { ...task, comments: [...task.comments, { id: newId('c'), authorId: accountId, content: text, createdAt: now() }] });
};
