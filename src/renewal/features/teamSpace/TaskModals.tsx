import React, { useEffect, useId, useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { relativeTime } from '@/renewal/domain/announcement';
import {
  TASK_ACTION_LABEL,
  TASK_LIMITS,
  TASK_STATUS_LABEL,
  availableActions,
  isOverdue,
  validateTask,
  type KanbanTask,
  type TaskAction,
  type TaskInput,
  type TaskViewer,
} from '@/renewal/domain/kanban';
import type { Member } from '@/renewal/domain/workspace';
import { Avatar, Badge, Button, Modal, fieldClassName, toast } from '@/renewal/ui';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.');

const emptyInput = (assigneeId?: string): TaskInput => ({ title: '', content: '', deadline: '', assigneeIds: assigneeId ? [assigneeId] : [] });
const toInput = (task: KanbanTask): TaskInput => ({ title: task.title, content: task.content ?? '', deadline: task.deadline ?? '', assigneeIds: task.assigneeIds });
const sameInput = (a: TaskInput, b: TaskInput) =>
  a.title === b.title && (a.content ?? '') === (b.content ?? '') && (a.deadline ?? '') === (b.deadline ?? '') && a.assigneeIds.join() === b.assigneeIds.join();

/** 제목·내용·마감일·담당자 입력. 만들기와 상세 편집이 함께 쓴다. */
const TaskFields: React.FC<{
  value: TaskInput;
  onChange: (value: TaskInput) => void;
  members: Member[];
  errors: Partial<Record<keyof TaskInput, string>>;
  readOnly?: boolean;
}> = ({ value, onChange, members, errors, readOnly }) => {
  const id = useId();
  const set = (patch: Partial<TaskInput>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold">
          제목
        </label>
        <input
          id={`${id}-title`}
          name="taskTitle"
          value={value.title}
          maxLength={TASK_LIMITS.titleMax}
          readOnly={readOnly}
          onChange={(event) => set({ title: event.target.value })}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          className={fieldClassName(Boolean(errors.title))}
        />
        {errors.title && (
          <p id={`${id}-title-error`} className="mt-1.5 text-sm text-danger">
            {errors.title}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-content`} className="mb-1.5 block text-sm font-semibold">
          내용 <span className="font-normal text-muted">(선택)</span>
        </label>
        <textarea
          id={`${id}-content`}
          rows={3}
          value={value.content ?? ''}
          maxLength={TASK_LIMITS.contentMax}
          readOnly={readOnly}
          onChange={(event) => set({ content: event.target.value })}
          className={fieldClassName(Boolean(errors.content), 'leading-6')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <label htmlFor={`${id}-deadline`} className="mb-1.5 block text-sm font-semibold">
            마감일 <span className="font-normal text-muted">(선택)</span>
          </label>
          <input
            id={`${id}-deadline`}
            type="date"
            value={value.deadline ?? ''}
            readOnly={readOnly}
            onChange={(event) => set({ deadline: event.target.value })}
            className={fieldClassName(Boolean(errors.deadline))}
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">담당자</legend>
          <div className="flex flex-wrap gap-1.5">
            {members.map((member) => {
              const checked = value.assigneeIds.includes(member.account.id);
              return (
                <label
                  key={member.account.id}
                  className={`inline-flex min-h-touch cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                    checked ? 'border-primary bg-primary-container font-semibold text-on-primary-container' : 'border-outline-soft text-ink'
                  } ${readOnly ? 'pointer-events-none opacity-70' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() =>
                      set({ assigneeIds: checked ? value.assigneeIds.filter((item) => item !== member.account.id) : [...value.assigneeIds, member.account.id] })
                    }
                  />
                  <Avatar name={member.account.name} imageUrl={member.account.profileImageUrl} size="xs" />
                  {member.account.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
};

export const CreateTaskModal: React.FC<{
  open: boolean;
  members: Member[];
  meId?: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: TaskInput) => Promise<boolean>;
}> = ({ open, members, meId, pending, onClose, onSubmit }) => {
  const [value, setValue] = useState<TaskInput>(emptyInput(meId));
  const [errors, setErrors] = useState<Partial<Record<keyof TaskInput, string>>>({});
  useEffect(() => {
    if (!open) return;
    setValue(emptyInput(meId));
    setErrors({});
  }, [open, meId]);
  const submit = async () => {
    const found = validateTask(value);
    setErrors(found);
    if (found.title) return document.getElementsByName('taskTitle')[0]?.focus();
    if (await onSubmit(value)) onClose();
  };
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title="새 태스크"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} loading={pending}>
            추가
          </Button>
        </>
      }
    >
      <TaskFields value={value} onChange={setValue} members={members} errors={errors} />
    </Modal>
  );
};

type NoteMode = Extract<TaskAction, 'request' | 'reject'> | null;

/**
 * 태스크 상세(14 §4.2). 편집, 상태 전이, 승인 기록, 댓글, 삭제를 한곳에서 다룬다.
 * 완료 요청은 메시지를 선택으로, 반려는 사유를 필수로 받는다. 매니저는 승인·반려 외에는 읽기만 한다.
 */
export const TaskDetailModal: React.FC<{
  task: KanbanTask | undefined;
  members: Member[];
  viewer: TaskViewer;
  nameOf: (accountId?: string) => string;
  busy: boolean;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<boolean>;
  onAction: (action: TaskAction, note?: string) => Promise<boolean>;
  onComment: (content: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}> = ({ task, members, viewer, nameOf, busy, onClose, onSave, onAction, onComment, onDelete }) => {
  const id = useId();
  const [value, setValue] = useState<TaskInput>(emptyInput());
  const [errors, setErrors] = useState<Partial<Record<keyof TaskInput, string>>>({});
  const [noteMode, setNoteMode] = useState<NoteMode>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string>();
  const [comment, setComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taskId = task?.id;

  useEffect(() => {
    if (!task) return;
    setValue(toInput(task));
    setErrors({});
    setNoteMode(null);
    setNote('');
    setActionError(undefined);
    // 다른 태스크를 열 때만 초기화한다. 같은 태스크의 상태 변경 후에는 입력을 지우지 않는다.
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;
  const actions = availableActions(task, viewer);
  const editable = viewer.isMember;
  const dirty = !sameInput(value, toInput(task));
  const canDelete = viewer.isMember && (task.createdBy === viewer.accountId || viewer.isLeader);

  const runAction = async (action: TaskAction) => {
    setActionError(undefined);
    if (action === 'request' && task.assigneeIds.length === 0) {
      setActionError('담당자를 먼저 배정해야 완료 요청을 할 수 있어요.');
      return;
    }
    if (action === 'request' && !task.assigneeIds.includes(viewer.accountId)) {
      setActionError('담당자만 완료 요청을 할 수 있어요.');
      return;
    }
    if ((action === 'request' || action === 'reject') && noteMode !== action) {
      setNoteMode(action);
      setNote('');
      return;
    }
    if (action === 'reject' && !note.trim()) {
      setActionError('반려 사유를 입력해 주세요.');
      document.getElementById(`${id}-note`)?.focus();
      return;
    }
    if (await onAction(action, noteMode === action ? note : undefined)) {
      setNoteMode(null);
      setNote('');
    }
  };

  const save = async () => {
    const found = validateTask(value);
    setErrors(found);
    if (found.title) return document.getElementsByName('taskTitle')[0]?.focus();
    await onSave(value);
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        preventClose={busy}
        title={task.title}
        size="2xl"
        footer={
          <>
            {canDelete && (
              <Button variant="ghost" className="mr-auto text-danger" leftIcon={<TrashIcon className="h-4 w-4" />} onClick={() => setConfirmDelete(true)} disabled={busy}>
                삭제
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={busy}>
              닫기
            </Button>
            {editable && (
              <Button onClick={save} loading={busy} disabled={!dirty}>
                저장
              </Button>
            )}
          </>
        }
      >
        <section aria-labelledby={`${id}-status`} className="mb-5 rounded-card bg-surface-low p-4">
          <h3 id={`${id}-status`} className="sr-only">
            상태
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={task.status === 'DONE' ? 'success' : task.status === 'APPROVAL_PENDING' ? 'warning' : 'neutral'}>{TASK_STATUS_LABEL[task.status]}</Badge>
            {isOverdue(task) && <Badge tone="error">마감 초과</Badge>}
            <span className="ml-auto flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={action === 'approve' || action === 'request' || action === 'start' ? 'primary' : 'outline'}
                  onClick={() => runAction(action)}
                  disabled={busy}
                  aria-expanded={action === 'request' || action === 'reject' ? noteMode === action : undefined}
                >
                  {TASK_ACTION_LABEL[action]}
                </Button>
              ))}
            </span>
          </div>
          {actionError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {actionError}
            </p>
          )}
          {noteMode && (
            <div className="mt-3">
              <label htmlFor={`${id}-note`} className="mb-1.5 block text-sm font-semibold">
                {noteMode === 'request' ? (
                  <>
                    팀장에게 남길 말 <span className="font-normal text-muted">(선택)</span>
                  </>
                ) : (
                  '반려 사유'
                )}
              </label>
              <textarea id={`${id}-note`} rows={2} value={note} maxLength={TASK_LIMITS.messageMax} onChange={(event) => setNote(event.target.value)} className={fieldClassName(false, 'leading-6')} autoFocus />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setNoteMode(null)} disabled={busy}>
                  취소
                </Button>
                <Button size="sm" onClick={() => runAction(noteMode)} loading={busy}>
                  {noteMode === 'request' ? '완료 요청 보내기' : '반려하기'}
                </Button>
              </div>
            </div>
          )}
          <dl className="mt-3 space-y-1 text-sm">
            {task.completionRequestedAt && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">완료 요청</dt>
                <dd>
                  {nameOf(task.completionRequestedBy)} · {relativeTime(task.completionRequestedAt)}
                  {task.completionRequestMessage && <span className="block text-muted">“{task.completionRequestMessage}”</span>}
                </dd>
              </div>
            )}
            {task.rejectedReason && task.status !== 'DONE' && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">반려 사유</dt>
                <dd>{task.rejectedReason}</dd>
              </div>
            )}
            {task.approvedAt && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">승인</dt>
                <dd>
                  {nameOf(task.approvedBy)} · {new Date(task.approvedAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted">만든 사람</dt>
              <dd>{nameOf(task.createdBy)}</dd>
            </div>
          </dl>
        </section>

        <TaskFields value={value} onChange={setValue} members={members} errors={errors} readOnly={!editable} />

        <section aria-labelledby={`${id}-comments`} className="mt-6 border-t border-outline-soft pt-4">
          <h3 id={`${id}-comments`} className="mb-2 text-sm font-semibold">
            댓글 <span className="text-muted tabular-nums">{task.comments.length}</span>
          </h3>
          {task.comments.length > 0 && (
            <ul className="mb-3 space-y-2">
              {task.comments.map((item) => (
                <li key={item.id} className="rounded-lg bg-surface-low px-3 py-2 text-sm">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-ink">{nameOf(item.authorId)}</span> · {relativeTime(item.createdAt)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line break-words">{item.content}</p>
                </li>
              ))}
            </ul>
          )}
          {editable ? (
            <div className="flex gap-2">
              <label htmlFor={`${id}-comment`} className="sr-only">
                댓글 쓰기
              </label>
              <input
                id={`${id}-comment`}
                value={comment}
                maxLength={TASK_LIMITS.commentMax}
                onChange={(event) => setComment(event.target.value)}
                placeholder="댓글을 남겨 주세요"
                className={fieldClassName(false, 'flex-1')}
              />
              <Button
                variant="outline"
                disabled={!comment.trim() || busy}
                onClick={async () => {
                  if (await onComment(comment)) setComment('');
                }}
              >
                등록
              </Button>
            </div>
          ) : (
            task.comments.length === 0 && <p className="text-sm text-muted">댓글이 없어요.</p>
          )}
        </section>
      </Modal>
      <ConfirmModal
        open={confirmDelete}
        title="태스크 삭제"
        description={`"${task.title}"을 삭제하면 댓글도 함께 지워지고 되돌릴 수 없어요.`}
        confirmLabel="삭제하기"
        pending={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (await onDelete()) {
            setConfirmDelete(false);
            toast.success('태스크를 삭제했어요.');
          }
        }}
      />
    </>
  );
};

export { errorMessage };
