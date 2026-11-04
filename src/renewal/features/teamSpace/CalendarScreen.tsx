import React, { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline';
import { SCHEDULE_LIMITS, canEditSchedule, dateKey, monthGrid, occursOn, validateSchedule, weekDays, type ScheduleInput } from '@/renewal/domain/collab';
import { SCHEDULE_TYPES, SCHEDULE_TYPE_LABEL, type Schedule, type ScheduleType } from '@/renewal/domain/teamSpace';
import { fromLocalInputValue, toLocalInputValue } from '@/renewal/domain/teamBuilding';
import { useCreateSchedule, useDeleteSchedule, useMe, useSchedules, useUpdateSchedule } from '@/renewal/data/queries';
import { Button, ErrorState, LoadingState, Modal, fieldClassName, toast } from '@/renewal/ui';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { useTeamSpaceContext } from './TeamSpaceLayout';
import { errorMessage } from './TaskModals';

type View = 'month' | 'week' | 'list';
const VIEWS: { id: View; label: string }[] = [
  { id: 'month', label: '월간' },
  { id: 'week', label: '주간' },
  { id: 'list', label: '리스트' },
];
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** 유형별 색. 색만으로 구분하지 않도록 항목마다 유형 이름을 글자로 함께 쓴다. */
const typeStyle: Record<ScheduleType, string> = {
  MEETING: 'border-l-primary bg-peri-50',
  DEADLINE: 'border-l-danger bg-red-50',
  WORKSHOP: 'border-l-warning bg-amber-50',
  VACATION: 'border-l-success bg-green-50',
  OTHER: 'border-l-neutral-400 bg-surface-low',
};
const typeDot: Record<ScheduleType, string> = {
  MEETING: 'bg-primary',
  DEADLINE: 'bg-danger',
  WORKSHOP: 'bg-warning',
  VACATION: 'bg-success',
  OTHER: 'bg-neutral-400',
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const parseKey = (key: string | null) => {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date();
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const byStart = (a: Schedule, b: Schedule) => a.startAt.localeCompare(b.startAt);

const defaultInput = (day: Date): ScheduleInput => {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0);
  return { title: '', description: '', type: 'MEETING', startAt: start.toISOString(), endAt: new Date(start.getTime() + 3_600_000).toISOString(), personal: false };
};

const ScheduleChip: React.FC<{ schedule: Schedule; onOpen: () => void; compact?: boolean }> = ({ schedule, onOpen, compact }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`block w-full rounded-md border-l-4 px-2 py-1 text-left text-xs leading-4 hover:brightness-95 ${typeStyle[schedule.type]}`}
  >
    <span className="font-semibold tabular-nums">{time(schedule.startAt)}</span> <span className={compact ? 'line-clamp-1' : ''}>{schedule.title}</span>
    <span className="sr-only">
      , {SCHEDULE_TYPE_LABEL[schedule.type]}
      {schedule.personal ? ', 내 일정' : ''}
    </span>
    {!compact && (
      <span className="mt-0.5 block text-[11px] text-muted" aria-hidden="true">
        {SCHEDULE_TYPE_LABEL[schedule.type]}
        {schedule.personal && ' · 내 일정'}
      </span>
    )}
  </button>
);

/** 일정 만들기·보기·고치기. 고칠 권한이 없으면 읽기만 한다. */
const ScheduleModal: React.FC<{
  open: boolean;
  schedule?: Schedule;
  initialDay: Date;
  canEdit: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: ScheduleInput) => Promise<boolean>;
  onDelete: () => void;
}> = ({ open, schedule, initialDay, canEdit, pending, onClose, onSubmit, onDelete }) => {
  const id = useId();
  const [value, setValue] = useState<ScheduleInput>(defaultInput(initialDay));
  const [errors, setErrors] = useState<Partial<Record<keyof ScheduleInput, string>>>({});
  useEffect(() => {
    if (!open) return;
    setValue(schedule ? { title: schedule.title, description: schedule.description ?? '', type: schedule.type, startAt: schedule.startAt, endAt: schedule.endAt, personal: schedule.personal } : defaultInput(initialDay));
    setErrors({});
    // 열 때만 초기화한다.
  }, [open, schedule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<ScheduleInput>) => setValue((prev) => ({ ...prev, ...patch }));
  const readOnly = Boolean(schedule) && !canEdit;
  const submit = async () => {
    const found = validateSchedule(value);
    setErrors(found);
    const first = (['title', 'startAt', 'endAt'] as const).find((key) => found[key]);
    if (first) return document.getElementById(`${id}-${first}`)?.focus();
    await onSubmit(value);
  };

  const field = (key: 'startAt' | 'endAt', label: string) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        type="datetime-local"
        value={value[key] ? toLocalInputValue(value[key]) : ''}
        readOnly={readOnly}
        onChange={(event) => set({ [key]: fromLocalInputValue(event.target.value) })}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        className={fieldClassName(Boolean(errors[key]))}
      />
      {errors[key] && (
        <p id={`${id}-${key}-error`} className="mt-1.5 text-sm text-danger">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title={schedule ? (readOnly ? schedule.title : '일정 고치기') : '새 일정'}
      description={readOnly ? '일정을 만든 사람과 팀장만 고칠 수 있어요.' : undefined}
      size="lg"
      footer={
        <>
          {schedule && canEdit && (
            <Button variant="ghost" className="mr-auto text-danger" leftIcon={<TrashIcon className="h-4 w-4" />} onClick={onDelete} disabled={pending}>
              삭제
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {readOnly ? '닫기' : '취소'}
          </Button>
          {!readOnly && (
            <Button onClick={submit} loading={pending}>
              {schedule ? '저장' : '추가'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold">
            일정 이름
          </label>
          <input
            id={`${id}-title`}
            value={value.title}
            maxLength={SCHEDULE_LIMITS.titleMax}
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
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">유형</legend>
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_TYPES.map((type) => (
              <label
                key={type}
                className={`inline-flex min-h-touch cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                  value.type === type ? 'border-primary bg-primary-container font-semibold text-on-primary-container' : 'border-outline-soft'
                } ${readOnly ? 'pointer-events-none' : ''}`}
              >
                <input type="radio" name={`${id}-type`} className="sr-only" checked={value.type === type} disabled={readOnly} onChange={() => set({ type })} />
                <span className={`h-2.5 w-2.5 rounded-full ${typeDot[type]}`} aria-hidden="true" />
                {SCHEDULE_TYPE_LABEL[type]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('startAt', '시작')}
          {field('endAt', '끝')}
        </div>
        <div>
          <label htmlFor={`${id}-desc`} className="mb-1.5 block text-sm font-semibold">
            설명 <span className="font-normal text-muted">(선택)</span>
          </label>
          <textarea id={`${id}-desc`} rows={2} value={value.description ?? ''} maxLength={SCHEDULE_LIMITS.descriptionMax} readOnly={readOnly} onChange={(event) => set({ description: event.target.value })} className={fieldClassName(false, 'leading-6')} />
        </div>
        <label className={`flex items-start gap-2 text-sm ${readOnly ? 'pointer-events-none' : ''}`}>
          <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={value.personal} disabled={readOnly || (Boolean(schedule) && !canEdit)} onChange={(event) => set({ personal: event.target.checked })} />
          <span>
            <span className="font-semibold">내 일정으로 두기</span>
            <span className="block text-muted">나에게만 보이고 팀원에게는 보이지 않아요.</span>
          </span>
        </label>
      </div>
    </Modal>
  );
};

/**
 * SCR-TM-03 일정(14 §4.3). 월간·주간·리스트 보기와 팀 일정·내 일정 레이어를 둔다.
 * 보기와 기준 날짜는 주소(?view=, ?date=)에 남긴다. 다른 사람의 개인 일정은 데이터에서부터 빠진다(14 §5.3).
 */
export const CalendarScreen: React.FC = () => {
  const { workspaceId, teamId, space } = useTeamSpaceContext();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const schedules = useSchedules(workspaceId, teamId);
  const create = useCreateSchedule(workspaceId, teamId);
  const update = useUpdateSchedule(workspaceId, teamId);
  const remove = useDeleteSchedule(workspaceId, teamId);
  const [showTeam, setShowTeam] = useState(true);
  const [showMine, setShowMine] = useState(false);
  const [editing, setEditing] = useState<{ schedule?: Schedule; day: Date } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const view: View = (['month', 'week', 'list'] as const).find((item) => item === params.get('view')) ?? 'month';
  const anchor = parseKey(params.get('date'));
  const today = dateKey(new Date());

  const go = (patch: { view?: View; date?: Date }) => {
    const next = new URLSearchParams(params);
    if (patch.view) next.set('view', patch.view);
    if (patch.date) next.set('date', dateKey(patch.date));
    setParams(next, { replace: true });
  };
  const shift = (direction: number) =>
    go({ date: view === 'week' ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + direction * 7) : new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1) });

  if (schedules.isLoading) return <LoadingState className="min-h-[40vh]" label="일정을 불러오는 중이에요" />;
  if (schedules.isError || !schedules.data) {
    return <ErrorState className="min-h-[40vh]" title="일정을 불러오지 못했어요" description="네트워크 상태를 확인한 뒤 다시 시도해 주세요." action={<Button onClick={() => schedules.refetch()}>다시 시도</Button>} />;
  }

  const visible = schedules.data.filter((item) => (item.personal ? showMine : showTeam)).sort(byStart);
  const on = (day: Date) => visible.filter((item) => occursOn(item, day));
  const viewer = { accountId: me.data?.id ?? '', isLeader: space.access.isLeader };
  const open = (schedule: Schedule) => setEditing({ schedule, day: new Date(schedule.startAt) });
  const title =
    view === 'week'
      ? (() => {
          const days = weekDays(anchor);
          return `${days[0].getMonth() + 1}월 ${days[0].getDate()}일 ~ ${days[6].getMonth() + 1}월 ${days[6].getDate()}일`;
        })()
      : `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`;

  const save = async (input: ScheduleInput) => {
    try {
      if (editing?.schedule) await update.mutateAsync({ scheduleId: editing.schedule.id, schedule: input });
      else await create.mutateAsync(input);
      toast.success(editing?.schedule ? '일정을 고쳤어요.' : '일정을 추가했어요.');
      if (input.personal && !showMine) setShowMine(true);
      setEditing(null);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const monthDays = monthGrid(anchor.getFullYear(), anchor.getMonth());
  const listDays = monthDays.flat().filter((day) => day.getMonth() === anchor.getMonth() && on(day).length > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">일정</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="보기" className="flex rounded-full bg-surface-container p-1">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => go({ view: item.id })}
                className={`min-h-[36px] rounded-full px-3 text-sm font-semibold ${view === item.id ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button leftIcon={<PlusIcon className="h-5 w-5" />} onClick={() => setEditing({ day: anchor })}>
            일정 추가
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label={view === 'week' ? '이전 주' : '이전 달'} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-container">
            <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="min-w-[9rem] text-center font-bold tabular-nums" aria-live="polite">
            {title}
          </p>
          <button type="button" onClick={() => shift(1)} aria-label={view === 'week' ? '다음 주' : '다음 달'} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-container">
            <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <Button size="sm" variant="outline" onClick={() => go({ date: new Date() })}>
            오늘
          </Button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-4 text-sm">
          <legend className="sr-only">레이어</legend>
          <label className="inline-flex min-h-touch items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={showTeam} onChange={(event) => setShowTeam(event.target.checked)} />
            팀 일정
          </label>
          <label className="inline-flex min-h-touch items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={showMine} onChange={(event) => setShowMine(event.target.checked)} />
            <UserIcon className="h-4 w-4 text-muted" aria-hidden="true" />내 일정
          </label>
        </fieldset>
      </div>

      {view === 'month' && (
        <div className="overflow-hidden rounded-card border border-outline-soft bg-surface">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">{title} 달력</caption>
            <thead>
              <tr>
                {WEEKDAY.map((day, index) => (
                  <th key={day} scope="col" className={`border-b border-outline-soft py-2 text-xs font-semibold ${index === 0 ? 'text-danger' : 'text-muted'}`}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthDays.map((week) => (
                <tr key={dateKey(week[0])}>
                  {week.map((day) => {
                    const items = on(day);
                    const outside = day.getMonth() !== anchor.getMonth();
                    const isToday = dateKey(day) === today;
                    return (
                      <td key={dateKey(day)} className={`h-24 border-b border-r border-outline-soft p-1 align-top last:border-r-0 sm:h-28 ${outside ? 'bg-surface-low' : ''}`}>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${isToday ? 'bg-primary font-bold text-on-primary' : outside ? 'text-neutral-400' : 'text-ink'}`}
                          aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일${isToday ? ', 오늘' : ''}`}
                        >
                          {day.getDate()}
                        </span>
                        {/* 좁은 화면에서는 점과 개수로 줄이고, 누르면 그 주를 주간 보기로 연다. */}
                        {items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => go({ view: 'week', date: day })}
                            className="mt-1 flex w-full items-center gap-0.5 sm:hidden"
                            aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일 일정 ${items.length}개 보기`}
                          >
                            {items.slice(0, 3).map((item) => (
                              <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${typeDot[item.type]}`} aria-hidden="true" />
                            ))}
                            {items.length > 3 && <span className="text-[10px] text-muted" aria-hidden="true">+{items.length - 3}</span>}
                          </button>
                        )}
                        <ul className="mt-1 hidden space-y-0.5 sm:block">
                          {items.slice(0, 3).map((item) => (
                            <li key={item.id}>
                              <ScheduleChip schedule={item} onOpen={() => open(item)} compact />
                            </li>
                          ))}
                          {items.length > 3 && (
                            <li>
                              <button type="button" className="px-1 text-xs font-semibold text-primary" onClick={() => go({ view: 'week', date: day })}>
                                +{items.length - 3}개 더
                              </button>
                            </li>
                          )}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'week' && (
        <ol className="grid gap-2 md:grid-cols-7">
          {weekDays(anchor).map((day, index) => {
            const items = on(day);
            const isToday = dateKey(day) === today;
            return (
              <li key={dateKey(day)} className={`rounded-card border p-2 ${isToday ? 'border-primary' : 'border-outline-soft'} bg-surface md:min-h-[12rem]`}>
                <h3 className={`mb-2 text-sm font-semibold ${index === 0 ? 'text-danger' : ''}`}>
                  {day.getMonth() + 1}/{day.getDate()} ({WEEKDAY[index]}){isToday && <span className="ml-1 text-xs text-primary">오늘</span>}
                </h3>
                {items.length === 0 ? (
                  <p className="text-xs text-muted">일정 없음</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.id}>
                        <ScheduleChip schedule={item} onOpen={() => open(item)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {view === 'list' &&
        (listDays.length === 0 ? (
          <p className="rounded-card border border-dashed border-outline-soft bg-surface px-4 py-8 text-center text-sm text-muted">이번 달에는 일정이 없어요.</p>
        ) : (
          <div className="space-y-4">
            {listDays.map((day) => (
              <section key={dateKey(day)} aria-labelledby={`day-${dateKey(day)}`}>
                <h3 id={`day-${dateKey(day)}`} className="mb-1.5 text-sm font-bold">
                  {day.getMonth() + 1}월 {day.getDate()}일 ({WEEKDAY[day.getDay()]})
                </h3>
                <ul className="space-y-1.5">
                  {on(day).map((item) => (
                    <li key={item.id}>
                      <ScheduleChip schedule={item} onOpen={() => open(item)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="일정 유형">
        {SCHEDULE_TYPES.map((type) => (
          <li key={type} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${typeDot[type]}`} aria-hidden="true" />
            {SCHEDULE_TYPE_LABEL[type]}
          </li>
        ))}
      </ul>

      <ScheduleModal
        open={editing !== null}
        schedule={editing?.schedule}
        initialDay={editing?.day ?? anchor}
        canEdit={editing?.schedule ? canEditSchedule(editing.schedule, viewer) : true}
        pending={create.isPending || update.isPending}
        onClose={() => setEditing(null)}
        onSubmit={save}
        onDelete={() => setConfirmDelete(true)}
      />
      <ConfirmModal
        open={confirmDelete}
        title="일정 삭제"
        description={`"${editing?.schedule?.title ?? ''}" 일정을 지우면 되돌릴 수 없어요.`}
        confirmLabel="삭제하기"
        pending={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(editing!.schedule!.id);
            toast.success('일정을 지웠어요.');
            setConfirmDelete(false);
            setEditing(null);
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
    </div>
  );
};
