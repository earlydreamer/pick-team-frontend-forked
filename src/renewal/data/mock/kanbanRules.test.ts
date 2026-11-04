import { describe, expect, it } from 'vitest';
import { seed, type MockDb } from './db';
import { DataError } from '../ports';
import { addComment, createTask, deleteTask, teamAccess, transition, updateTask } from './kanbanRules';

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
const task = (db: MockDb, id: string) => db.tasks.find((item) => item.id === id)!;

describe('팀 스페이스 접근', () => {
  it('팀원은 들어오고, 팀원이 아닌 멤버에게는 팀을 숨긴다', () => {
    expect(teamAccess(seed(), WS, T1, 'u-01')).toEqual({ isMember: true, isLeader: true, isManagerViewer: false });
    expect(codeOf(() => teamAccess(seed(), WS, T1, 'u-03'))).toBe('NOT_FOUND');
  });

  it('팀원이 아닌 매니저는 집계 보기 자격으로 들어온다', () => {
    expect(teamAccess(seed(), WS, T1, 'u-instructor')).toEqual({ isMember: false, isLeader: false, isManagerViewer: true });
  });
});

describe('태스크 작성', () => {
  it('팀원은 태스크를 만들고, 매니저는 만들지 못한다', () => {
    const { db, taskId } = createTask(seed(), WS, T1, 'u-02', { title: '새 태스크', assigneeIds: ['u-02'] });
    expect(task(db, taskId)).toMatchObject({ status: 'TODO', createdBy: 'u-02' });
    expect(codeOf(() => createTask(seed(), WS, T1, 'u-instructor', { title: '개입', assigneeIds: [] }))).toBe('FORBIDDEN');
  });

  it('팀원이 아닌 담당자는 조용히 넘기지 않고 오류로 알린다', () => {
    expect(codeOf(() => updateTask(seed(), WS, T1, 'u-01', 'k-6', { title: '알림 설계', assigneeIds: ['u-03'] }))).toBe('INVALID');
  });

  it('만든 사람과 팀장만 지운다', () => {
    const { db, taskId } = createTask(seed(), WS, T1, 'u-02', { title: '지울 태스크', assigneeIds: [] });
    expect(codeOf(() => deleteTask(seed(), WS, T1, 'u-02', 'k-1'))).toBe('FORBIDDEN');
    expect(deleteTask(db, WS, T1, 'u-01', taskId).tasks.some((item) => item.id === taskId)).toBe(false);
  });
});

describe('승인 워크플로', () => {
  it('담당자가 없으면 완료 요청을 막는다', () => {
    const started = transition(seed(), WS, T1, 'u-02', 'k-6', 'start');
    expect(codeOf(() => transition(started, WS, T1, 'u-02', 'k-6', 'request'))).toBe('INVALID');
  });

  it('담당자가 아닌 팀원은 완료 요청을 하지 못한다', () => {
    expect(codeOf(() => transition(seed(), WS, T1, 'u-01', 'k-7', 'request'))).toBe('FORBIDDEN');
  });

  it('담당자 요청 → 팀장 반려(사유 필수) → 재요청 → 승인 기록', () => {
    let db = transition(seed(), WS, T1, 'u-02', 'k-7', 'request', '구현 끝났어요');
    expect(task(db, 'k-7')).toMatchObject({ status: 'APPROVAL_PENDING', completionRequestedBy: 'u-02', completionRequestMessage: '구현 끝났어요' });
    expect(codeOf(() => transition(db, WS, T1, 'u-02', 'k-7', 'approve'))).toBe('CONFLICT');
    expect(codeOf(() => transition(db, WS, T1, 'u-01', 'k-7', 'reject'))).toBe('INVALID');
    db = transition(db, WS, T1, 'u-01', 'k-7', 'reject', '모바일 화면도 확인해 주세요');
    expect(task(db, 'k-7')).toMatchObject({ status: 'IN_PROGRESS', rejectedReason: '모바일 화면도 확인해 주세요' });
    db = transition(db, WS, T1, 'u-02', 'k-7', 'request');
    db = transition(db, WS, T1, 'u-01', 'k-7', 'approve');
    expect(task(db, 'k-7')).toMatchObject({ status: 'DONE', approvedBy: 'u-01' });
  });

  it('매니저는 팀원이 아니어도 승인에 개입하고 기록이 남는다', () => {
    const db = transition(seed(), WS, T1, 'u-instructor', 'k-4', 'approve');
    expect(task(db, 'k-4')).toMatchObject({ status: 'DONE', approvedBy: 'u-instructor' });
    expect(codeOf(() => transition(seed(), WS, T1, 'u-instructor', 'k-6', 'start'))).toBe('CONFLICT');
  });

  it('댓글은 팀원만 단다', () => {
    expect(task(addComment(seed(), WS, T1, 'u-02', 'k-4', '확인했어요'), 'k-4').comments).toHaveLength(1);
    expect(codeOf(() => addComment(seed(), WS, T1, 'u-instructor', 'k-4', '확인'))).toBe('FORBIDDEN');
  });
});
