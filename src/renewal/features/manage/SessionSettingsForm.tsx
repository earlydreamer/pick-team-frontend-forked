import React, { useId, useState } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  SESSION_RULES,
  fromLocalInputValue,
  toLocalInputValue,
  validateSessionSettings,
  type SessionSettingsInput,
} from '@/renewal/domain/teamBuilding';
import { Button, Modal, fieldClassName } from '@/renewal/ui';

const inDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
};

/** 모집 마감 입력. 브라우저 기본 날짜·시간 입력을 써서 키보드와 보조기기 지원을 그대로 얻는다. */
const DeadlineField: React.FC<{ id: string; value: string; error?: string; onChange: (iso: string) => void }> = ({ id, value, error, onChange }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
      모집 마감
    </label>
    <input
      id={id}
      type="datetime-local"
      value={value ? toLocalInputValue(value) : ''}
      onChange={(event) => onChange(fromLocalInputValue(event.target.value))}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={fieldClassName(Boolean(error), 'sm:max-w-xs')}
    />
    {error && (
      <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
        {error}
      </p>
    )}
  </div>
);

/**
 * 세션 설정(12 §4.4 DRAFT 단계): 모집 마감과 팀 정원.
 * 기획의 정원 min/max, 구성 방식, 팀 개설 권한은 아직 다루지 않는다(docs/renewal/implementation.md R6).
 */
export const SessionSettingsForm: React.FC<{
  initial?: SessionSettingsInput;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: SessionSettingsInput) => void;
}> = ({ initial, submitLabel, pending, onSubmit }) => {
  const deadlineId = useId();
  const capacityId = useId();
  const [closesAt, setClosesAt] = useState(initial?.closesAt ?? inDays(7));
  const [teamCapacity, setTeamCapacity] = useState(initial?.teamCapacity ?? 4);
  const [errors, setErrors] = useState<ReturnType<typeof validateSessionSettings>>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = { closesAt, teamCapacity };
    const found = validateSessionSettings(input);
    setErrors(found);
    if (found.closesAt) return document.getElementById(deadlineId)?.focus();
    if (found.teamCapacity) return document.getElementById(capacityId)?.focus();
    onSubmit(input);
  };

  const step = (delta: number) => setTeamCapacity((value) => Math.min(SESSION_RULES.capacityMax, Math.max(SESSION_RULES.capacityMin, value + delta)));

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <DeadlineField id={deadlineId} value={closesAt} error={errors.closesAt} onChange={setClosesAt} />
      <div>
        <label htmlFor={capacityId} className="mb-1.5 block text-sm font-semibold">
          팀 정원 <span className="font-normal text-muted">(팀장 포함)</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={teamCapacity <= SESSION_RULES.capacityMin}
            aria-label="팀 정원 줄이기"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-outline-soft disabled:opacity-40"
          >
            <MinusIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            id={capacityId}
            type="number"
            inputMode="numeric"
            min={SESSION_RULES.capacityMin}
            max={SESSION_RULES.capacityMax}
            value={teamCapacity}
            onChange={(event) => setTeamCapacity(Number(event.target.value))}
            aria-invalid={errors.teamCapacity ? true : undefined}
            aria-describedby={errors.teamCapacity ? `${capacityId}-error` : undefined}
            className={fieldClassName(Boolean(errors.teamCapacity), 'w-20 text-center tabular-nums')}
          />
          <button
            type="button"
            onClick={() => step(1)}
            disabled={teamCapacity >= SESSION_RULES.capacityMax}
            aria-label="팀 정원 늘리기"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-outline-soft disabled:opacity-40"
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="text-sm text-muted">명</span>
        </div>
        {errors.teamCapacity && (
          <p id={`${capacityId}-error`} className="mt-1.5 text-sm text-danger">
            {errors.teamCapacity}
          </p>
        )}
      </div>
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
};

/** 모집 중 마감 연장. 정원은 바꾸지 않는다. */
export const ExtendDeadlineModal: React.FC<{
  open: boolean;
  closesAt: string;
  teamCapacity: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: SessionSettingsInput) => void;
}> = ({ open, closesAt, teamCapacity, pending, onClose, onSubmit }) => {
  const id = useId();
  const [value, setValue] = useState(closesAt);
  const [error, setError] = useState<string>();

  React.useEffect(() => {
    if (!open) return;
    setValue(new Date(new Date(closesAt).getTime() + 86_400_000).toISOString());
    setError(undefined);
  }, [open, closesAt]);

  const submit = () => {
    const input = { closesAt: value, teamCapacity };
    const found = validateSessionSettings(input, new Date(), closesAt);
    setError(found.closesAt);
    if (found.closesAt) {
      document.getElementById(id)?.focus();
      return;
    }
    onSubmit(input);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title="모집 마감 연장"
      description="지금 마감보다 뒤로만 옮길 수 있어요."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} loading={pending}>
            연장하기
          </Button>
        </>
      }
    >
      <DeadlineField id={id} value={value} error={error} onChange={setValue} />
    </Modal>
  );
};
