import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatBubbleLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { TASK_STATUSES, TASK_STATUS_LABEL, isOverdue, type KanbanTask, type TaskAction, type TaskInput, type TaskViewer } from '@/renewal/domain/kanban';
import { useAddComment, useCreateTask, useDeleteTask, useMe, useTasks, useTransitionTask, useUpdateTask } from '@/renewal/data/queries';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState, toast } from '@/renewal/ui';
import { activeDelegation } from '@/renewal/domain/teamSpace';
import { useTeamSpaceContext } from './TeamSpaceLayout';
import { CreateTaskModal, TaskDetailModal, errorMessage } from './TaskModals';

const formatDeadline = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

const actionDone: Record<TaskAction, string> = {
  start: '진행 중으로 옮겼어요.',
  back: '할 일로 되돌렸어요.',
  request: '완료 요청을 보냈어요. 팀장이 승인하면 완료돼요.',
  approve: '승인했어요. 승인자로 기록됐어요.',
  reject: '반려했어요. 담당자에게 사유가 보여요.',
  reopen: '다시 진행 중으로 열었어요.',
};

/** 칸반 카드. 누르면 상세를 연다. 상태와 경고는 색과 함께 글자로 알린다. */
const TaskCard: React.FC<{ task: KanbanTask; nameOf: (id?: string) => string; onOpen: () => void; members: Map<string, { name: string; image?: string | null }> }> = ({
  task,
  nameOf,
  onOpen,
  members,
}) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-card border border-outline-soft bg-surface p-3 text-left shadow-sm transition-colors hover:border-peri-300 hover:bg-peri-50"
    >
      <span className="block font-semibold leading-6">{task.title}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {task.status === 'APPROVAL_PENDING' && <Badge tone="warning">승인 대기</Badge>}
        {task.status === 'IN_PROGRESS' && task.rejectedReason && <Badge tone="error">반려됨</Badge>}
        {isOverdue(task) && <Badge tone="error">마감 초과</Badge>}
        {task.deadline && <span className="text-xs text-muted">마감 {formatDeadline(task.deadline)}</span>}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center -space-x-1.5">
          {task.assigneeIds.length === 0 ? (
            <span className="text-xs text-muted">담당자 없음</span>
          ) : (
            task.assigneeIds.map((id) => <Avatar key={id} name={members.get(id)?.name} imageUrl={members.get(id)?.image} size="xs" className="ring-2 ring-surface" />)
          )}
          {task.assigneeIds.length > 0 && <span className="sr-only">담당 {task.assigneeIds.map((id) => nameOf(id)).join(', ')}</span>}
        </span>
        {task.comments.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted">
            <ChatBubbleLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {task.comments.length}
            <span className="sr-only">개 댓글</span>
          </span>
        )}
      </span>
      {task.status === 'DONE' && task.approvedBy && <span className="mt-1.5 block text-xs text-muted">승인 {nameOf(task.approvedBy)}</span>}
    </button>
  </li>
);

/**
 * SCR-TM-02 칸반(14 §4.2). 할 일, 진행 중, 완료 요청, 완료(승인) 네 칸으로 승인 워크플로를 드러낸다.
 * 상태 이동은 카드 상세의 버튼으로 한다. 드래그만으로 옮기는 방식은 키보드로 쓸 수 없어 두지 않았다.
 * 필터(?filter=pending)와 열린 태스크(?task=)는 주소에 남겨 대시보드 승인 큐에서 바로 들어올 수 있게 한다.
 */
export const KanbanScreen: React.FC = () => {
  const { workspaceId, teamId, space } = useTeamSpaceContext();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const tasks = useTasks(workspaceId, teamId);
  const create = useCreateTask(workspaceId, teamId);
  const update = useUpdateTask(workspaceId, teamId);
  const transition = useTransitionTask(workspaceId, teamId);
  const remove = useDeleteTask(workspaceId, teamId);
  const comment = useAddComment(workspaceId, teamId);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const filter = params.get('filter') === 'pending' ? 'pending' : 'all';
  const openTaskId = params.get('task');
  const { access, members } = space;

  // 개요 체크리스트에서 ?new=1로 들어오면 만들기 대화상자를 연다. 주소에서는 지워 새로 고침해도 다시 열리지 않게 한다.
  useEffect(() => {
    if (params.get('new') === '1') {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  // 알림이나 대시보드에서 지워진 태스크로 들어오면 안내하고 주소에서 지운다(16 §6.4).
  // 이 화면에서 연 태스크가 사라졌으면(내가 지웠거나 다른 사람이 지움) 안내만 바꾼다.
  const seenTaskRef = useRef<string | null>(null);
  const deletedByMeRef = useRef<string | null>(null);
  const missingTask = Boolean(openTaskId && tasks.data && !tasks.data.some((task) => task.id === openTaskId));
  useEffect(() => {
    if (!missingTask) return;
    if (deletedByMeRef.current !== openTaskId) toast.info(seenTaskRef.current === openTaskId ? '다른 사람이 지운 태스크예요.' : '삭제됐거나 볼 수 없는 태스크예요.');
    const next = new URLSearchParams(params);
    next.delete('task');
    setParams(next, { replace: true });
  }, [missingTask]); // eslint-disable-line react-hooks/exhaustive-deps
  if (openTaskId && tasks.data?.some((task) => task.id === openTaskId)) seenTaskRef.current = openTaskId;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === 'filter' });
  };

  if (tasks.isLoading) return <LoadingState className="min-h-[40vh]" label="칸반을 불러오는 중이에요" />;
  if (tasks.isError || !tasks.data) {
    return <ErrorState className="min-h-[40vh]" title="칸반을 불러오지 못했어요" description="네트워크 상태를 확인한 뒤 다시 시도해 주세요." action={<Button onClick={() => tasks.refetch()}>다시 시도</Button>} />;
  }

  const memberMap = new Map(members.map((member) => [member.account.id, { name: member.account.name, image: member.account.profileImageUrl }]));
  const staffName = (id: string) => space.staff.find((account) => account.id === id)?.name;
  // 팀원이 아닌 매니저가 승인했으면 이름 뒤에 역할을 붙여 개입 승인임을 알린다(14 §4.2 승인 기록).
  const nameOf = (id?: string) => (!id ? '' : memberMap.get(id)?.name ?? (staffName(id) ? `${staffName(id)}(매니저)` : '알 수 없음'));
  const viewer: TaskViewer = { accountId: me.data?.id ?? '', isMember: access.isMember, isLeader: access.isLeader, isManager: access.isManagerViewer };
  const all = [...tasks.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pending = all.filter((task) => task.status === 'APPROVAL_PENDING');
  const openTask = all.find((task) => task.id === openTaskId);
  const approver = access.isLeader || access.isManagerViewer;
  const busy = update.isPending || transition.isPending || remove.isPending || comment.isPending;

  const attempt = async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work();
      if (done) toast.success(done);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const filterClass = (active: boolean) =>
    `inline-flex min-h-touch items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${active ? 'bg-primary text-on-primary' : 'bg-surface-container text-ink hover:bg-peri-100'}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">칸반</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="보기" className="flex gap-1.5">
            <button type="button" aria-pressed={filter === 'all'} className={filterClass(filter === 'all')} onClick={() => setParam('filter', null)}>
              전체 <span className="tabular-nums">{all.length}</span>
            </button>
            <button type="button" aria-pressed={filter === 'pending'} className={filterClass(filter === 'pending')} onClick={() => setParam('filter', 'pending')}>
              승인 대기
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${pending.length > 0 && approver ? 'bg-danger text-white' : ''}`}>{pending.length}</span>
            </button>
          </div>
          {access.isMember && (
            <Button leftIcon={<PlusIcon className="h-5 w-5" />} onClick={() => setCreating(true)}>
              새 태스크
            </Button>
          )}
        </div>
      </div>

      {access.isLeader && activeDelegation(space.team) && pending.length > 0 && (
        <p role="status" className="mb-4 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning">
          승인 대기 중인 태스크가 있어요. 팀장 위임이 끝난 뒤 승인을 진행해 주세요.
        </p>
      )}
      {filter === 'pending' ? (
        pending.length === 0 ? (
          <div className="rounded-card border border-dashed border-outline-soft bg-surface">
            <EmptyState compact title="승인을 기다리는 태스크가 없어요" />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="승인 대기 태스크">
            {pending.map((task) => (
              <TaskCard key={task.id} task={task} nameOf={nameOf} members={memberMap} onOpen={() => setParam('task', task.id)} />
            ))}
          </ul>
        )
      ) : all.length === 0 ? (
        <div className="rounded-card border border-dashed border-outline-soft bg-surface">
          <EmptyState
            compact
            title="아직 태스크가 없어요"
            description={access.isMember ? '할 일을 태스크로 나눠 담당자를 정해 보세요.' : undefined}
            action={access.isMember ? <Button size="sm" onClick={() => setCreating(true)}>첫 태스크 추가</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => {
            const items = all.filter((task) => task.status === status);
            return (
              <section key={status} aria-labelledby={`col-${status}`} className={`rounded-card p-3 ${status === 'APPROVAL_PENDING' ? 'bg-amber-50' : 'bg-surface-low'}`}>
                <h3 id={`col-${status}`} className="mb-2 flex items-center gap-2 px-1 text-sm font-bold">
                  {TASK_STATUS_LABEL[status]}
                  <span className="text-muted tabular-nums">{items.length}</span>
                </h3>
                {items.length === 0 ? (
                  <p className="px-1 py-3 text-sm text-muted">비어 있어요</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((task) => (
                      <TaskCard key={task.id} task={task} nameOf={nameOf} members={memberMap} onOpen={() => setParam('task', task.id)} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <CreateTaskModal
        open={creating}
        members={members}
        meId={access.isMember ? me.data?.id : undefined}
        pending={create.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(input: TaskInput) => attempt(() => create.mutateAsync(input), '태스크를 추가했어요.')}
      />
      <TaskDetailModal
        task={openTask}
        members={members}
        viewer={viewer}
        nameOf={nameOf}
        busy={busy}
        onClose={() => setParam('task', null)}
        onSave={(input) => attempt(() => update.mutateAsync({ taskId: openTask!.id, task: input }), '저장했어요.')}
        onAction={(action, note) => attempt(() => transition.mutateAsync({ taskId: openTask!.id, action, note }), actionDone[action])}
        onComment={(content) => attempt(() => comment.mutateAsync({ taskId: openTask!.id, content }))}
        onDelete={async () => {
          deletedByMeRef.current = openTask!.id;
          const ok = await attempt(() => remove.mutateAsync(openTask!.id));
          if (ok) setParam('task', null);
          return ok;
        }}
      />
      {openTaskId && !openTask && (
        <p role="status" className="mt-4 text-sm text-muted">
          요청한 태스크를 찾을 수 없어요. 삭제됐거나 다른 팀의 태스크예요.
        </p>
      )}
    </div>
  );
};
