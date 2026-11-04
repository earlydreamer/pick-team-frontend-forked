/**
 * 칸반 도메인. 근거: docs/renewal/spec/14-collab-tools.md §4.2, §5.2, §6.2.
 * 승인 워크플로를 상태 4개(할 일, 진행 중, 완료 요청, 완료)로 드러낸다.
 * 백엔드는 사용자 정의 리스트와 isApproved·completionRequested 플래그로 표현하므로 http 어댑터에서 매핑이 필요하다.
 */

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'APPROVAL_PENDING' | 'DONE';
export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'APPROVAL_PENDING', 'DONE'];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  APPROVAL_PENDING: '완료 요청',
  DONE: '완료',
};

export interface TaskComment {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface KanbanTask {
  id: string;
  teamId: string;
  title: string;
  content?: string;
  /** 마감일(YYYY-MM-DD) */
  deadline?: string;
  status: TaskStatus;
  assigneeIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completionRequestMessage?: string;
  completionRequestedBy?: string;
  completionRequestedAt?: string;
  /** 승인 기록(14 §4.2): 팀장 또는 개입한 매니저 */
  approvedBy?: string;
  approvedAt?: string;
  /** 마지막 반려 사유 */
  rejectedReason?: string;
  comments: TaskComment[];
}

export const TASK_LIMITS = { titleMax: 100, contentMax: 2000, commentMax: 500, messageMax: 200 } as const;

export interface TaskInput {
  title: string;
  content?: string;
  deadline?: string;
  assigneeIds: string[];
}

/** 상태 전이 행동 */
export type TaskAction = 'start' | 'back' | 'request' | 'approve' | 'reject' | 'reopen';
export const TASK_ACTION_LABEL: Record<TaskAction, string> = {
  start: '진행 시작',
  back: '할 일로 되돌리기',
  request: '완료 요청',
  approve: '승인',
  reject: '반려',
  reopen: '다시 열기',
};

export interface TaskViewer {
  accountId: string;
  /** 팀원(팀장 포함) */
  isMember: boolean;
  isLeader: boolean;
  /** 워크스페이스 개설자·매니저: 승인 개입만 할 수 있다(14 §2) */
  isManager: boolean;
}

/**
 * 보는 사람이 할 수 있는 상태 전이. 화면은 이 목록으로 버튼을 그리고, 목 규칙도 같은 함수로 권한을 검사한다.
 * 완료 요청은 담당자만, 승인·반려는 팀장과 매니저만 할 수 있다.
 */
export const availableActions = (task: KanbanTask, viewer: TaskViewer): TaskAction[] => {
  const canApprove = viewer.isLeader || viewer.isManager;
  switch (task.status) {
    case 'TODO':
      return viewer.isMember ? ['start'] : [];
    case 'IN_PROGRESS':
      return viewer.isMember ? ['request', 'back'] : [];
    case 'APPROVAL_PENDING':
      return canApprove ? ['approve', 'reject'] : [];
    case 'DONE':
      return viewer.isLeader ? ['reopen'] : [];
  }
};

/** 마감일이 지났고 아직 완료되지 않은 태스크(14 §5.2 마감 초과 배지) */
export const isOverdue = (task: Pick<KanbanTask, 'deadline' | 'status'>, now = new Date()) => {
  if (!task.deadline || task.status === 'DONE') return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return task.deadline < today;
};

export interface KanbanProgress {
  total: number;
  byStatus: Record<TaskStatus, number>;
  /** 완료(승인) 비율, 0~100 */
  completionRate: number;
}

export const progressOf = (tasks: Pick<KanbanTask, 'status'>[]): KanbanProgress => {
  const byStatus: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, APPROVAL_PENDING: 0, DONE: 0 };
  tasks.forEach((task) => (byStatus[task.status] += 1));
  return { total: tasks.length, byStatus, completionRate: tasks.length ? Math.round((byStatus.DONE / tasks.length) * 100) : 0 };
};

export const validateTask = (input: TaskInput) => {
  const errors: Partial<Record<keyof TaskInput, string>> = {};
  const title = input.title.trim();
  if (!title) errors.title = '제목을 입력해 주세요.';
  else if (title.length > TASK_LIMITS.titleMax) errors.title = `제목은 ${TASK_LIMITS.titleMax}자까지 쓸 수 있어요.`;
  if ((input.content ?? '').length > TASK_LIMITS.contentMax) errors.content = `내용은 ${TASK_LIMITS.contentMax}자까지 쓸 수 있어요.`;
  if (input.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) errors.deadline = '마감일 형식을 확인해 주세요.';
  return errors;
};
