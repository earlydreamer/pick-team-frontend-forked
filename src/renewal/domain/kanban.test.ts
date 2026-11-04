import { describe, expect, it } from 'vitest';
import { availableActions, isOverdue, progressOf, validateTask, type KanbanTask, type TaskViewer } from './kanban';

const task = (status: KanbanTask['status'], extra: Partial<KanbanTask> = {}): KanbanTask => ({
  id: 'k', teamId: 't', title: '태스크', status, assigneeIds: ['a'], createdBy: 'a', createdAt: '', updatedAt: '', comments: [], ...extra,
});
const member: TaskViewer = { accountId: 'a', isMember: true, isLeader: false, isManager: false };
const leader: TaskViewer = { ...member, accountId: 'l', isLeader: true };
const manager: TaskViewer = { accountId: 'm', isMember: false, isLeader: false, isManager: true };

describe('availableActions', () => {
  it('팀원은 진행 시작과 완료 요청을 하고, 승인은 하지 못한다', () => {
    expect(availableActions(task('TODO'), member)).toEqual(['start']);
    expect(availableActions(task('IN_PROGRESS'), member)).toEqual(['request', 'back']);
    expect(availableActions(task('APPROVAL_PENDING'), member)).toEqual([]);
  });

  it('팀장과 매니저는 완료 요청을 승인하거나 반려한다', () => {
    expect(availableActions(task('APPROVAL_PENDING'), leader)).toEqual(['approve', 'reject']);
    expect(availableActions(task('APPROVAL_PENDING'), manager)).toEqual(['approve', 'reject']);
  });

  it('매니저는 승인 외의 상태 전이를 하지 못하고, 완료를 다시 여는 것은 팀장만 한다', () => {
    expect(availableActions(task('TODO'), manager)).toEqual([]);
    expect(availableActions(task('DONE'), member)).toEqual([]);
    expect(availableActions(task('DONE'), leader)).toEqual(['reopen']);
  });
});

describe('진행도와 마감', () => {
  it('완료율은 승인된 태스크 비율이다', () => {
    const progress = progressOf([task('DONE'), task('DONE'), task('APPROVAL_PENDING'), task('TODO'), task('IN_PROGRESS')]);
    expect(progress).toMatchObject({ total: 5, completionRate: 40 });
    expect(progress.byStatus.APPROVAL_PENDING).toBe(1);
    expect(progressOf([]).completionRate).toBe(0);
  });

  it('마감일이 오늘보다 앞이고 완료되지 않았으면 마감 초과다', () => {
    const now = new Date(2026, 10, 5);
    expect(isOverdue({ deadline: '2026-11-04', status: 'IN_PROGRESS' }, now)).toBe(true);
    expect(isOverdue({ deadline: '2026-11-05', status: 'IN_PROGRESS' }, now)).toBe(false);
    expect(isOverdue({ deadline: '2026-11-04', status: 'DONE' }, now)).toBe(false);
  });

  it('제목은 필수이고 마감일은 날짜 형식이어야 한다', () => {
    expect(validateTask({ title: ' ', assigneeIds: [] }).title).toBeDefined();
    expect(validateTask({ title: '태스크', deadline: '11/04', assigneeIds: [] }).deadline).toBeDefined();
    expect(validateTask({ title: '태스크', deadline: '2026-11-04', assigneeIds: [] })).toEqual({});
  });
});
