import React, { useEffect, useId, useState } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import {
  CARD_LIMITS,
  HASHTAG_PATTERN,
  MBTI_TYPES,
  ROLES,
  ROLE_LABEL,
  TIME_SLOTS,
  TIME_SLOT_LABEL,
  WEEKLY_HOURS,
  WEEKLY_HOURS_LABEL,
  WORKSTYLES,
  WORKSTYLE_LABEL,
  type GoalTemperature,
  type Mbti,
  type Role,
  type TimeSlot,
  type WeeklyHours,
  type Workstyle,
} from '@/renewal/domain/card';
import { fieldClassName } from '@/renewal/ui';
import { data } from '@/renewal/data';

/*
 * PR 카드 입력 부품. 온보딩 위저드(SCR-ONB-01)와 카드 편집(SCR-MY-02)이 같이 쓴다.
 * 선택지는 실제 radio·checkbox 입력을 칩 모양으로 그려 키보드(화살표, Space)와 스크린리더 동작을 그대로 쓴다.
 */

const chipBase =
  'inline-flex min-h-touch cursor-pointer select-none items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus';
const chipIdle = 'border-outline bg-surface text-ink hover:bg-surface-container';
const chipChecked = 'border-primary bg-primary-container text-on-primary-container';
const chipDisabled = 'cursor-not-allowed border-outline-soft bg-surface-low text-neutral-500';

export const RequiredMark: React.FC = () => (
  <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 align-middle text-[0.6875rem] font-semibold text-danger ring-1 ring-inset ring-red-200">
    필수
  </span>
);

/** 필드 묶음: 제목(legend), 설명, 오류를 한 단위로 연결한다. */
export const FieldGroup: React.FC<{
  legend: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  id?: string;
  legendClassName?: string;
}> = ({ legend, description, error, children, id, legendClassName = 'text-sm font-semibold' }) => {
  const descriptionId = useId();
  const errorId = useId();
  return (
    <fieldset id={id} aria-describedby={[description ? descriptionId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined}>
      <legend className={`mb-1 text-ink ${legendClassName}`}>{legend}</legend>
      {description && (
        <p id={descriptionId} className="mb-3 text-sm text-muted">
          {description}
        </p>
      )}
      {!description && <div className="mb-2" />}
      {children}
      {error && (
        <p id={errorId} className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
};

interface ChoiceProps<T extends string> {
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  disabledOptions?: readonly T[];
  icon?: React.ReactNode;
}

export function RadioChips<T extends string>({
  name,
  options,
  labels,
  value,
  onChange,
  disabledOptions = [],
  icon,
}: ChoiceProps<T> & { value?: T; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = value === option;
        const disabled = disabledOptions.includes(option);
        return (
          <label key={option} className="relative">
            <input
              type="radio"
              name={name}
              value={option}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span className={`${chipBase} ${disabled ? chipDisabled : checked ? chipChecked : chipIdle}`}>
              {checked ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : icon}
              {labels[option]}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function CheckboxChips<T extends string>({
  name,
  options,
  labels,
  values,
  onChange,
  disabledOptions = [],
  max,
}: ChoiceProps<T> & { values: readonly T[]; onChange: (values: T[]) => void; max?: number }) {
  const reachedMax = max !== undefined && values.length >= max;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = values.includes(option);
        const disabled = !checked && (disabledOptions.includes(option) || reachedMax);
        return (
          <label key={option} className="relative">
            <input
              type="checkbox"
              name={name}
              value={option}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(checked ? values.filter((item) => item !== option) : [...values, option])}
              className="peer sr-only"
            />
            <span className={`${chipBase} ${disabled ? chipDisabled : checked ? chipChecked : chipIdle}`}>
              {checked && <CheckIcon className="h-4 w-4" aria-hidden="true" />}
              {labels[option]}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ── 희망 역할 ── */

export const RoleRadioField: React.FC<{
  rank: 1 | 2;
  value?: Role;
  other?: Role;
  onChange: (role: Role) => void;
  error?: string;
}> = ({ rank, value, other, onChange, error }) => (
  <FieldGroup legend={`${rank}순위`} error={error} legendClassName="text-sm font-semibold text-muted">
    <RadioChips
      name={`role-${rank}`}
      options={ROLES}
      labels={ROLE_LABEL}
      value={value}
      onChange={onChange}
      // 1순위로 고른 역할은 2순위에서 고를 수 없다(11 §4.1.1).
      disabledOptions={rank === 2 && other ? [other] : []}
    />
  </FieldGroup>
);

export const RoleSelect: React.FC<{
  id: string;
  label: string;
  value?: Role;
  other?: Role;
  onChange: (role?: Role) => void;
  error?: string;
}> = ({ id, label, value, other, onChange, error }) => {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange((event.target.value || undefined) as Role | undefined)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={fieldClassName(Boolean(error), 'appearance-auto')}
      >
        <option value="">선택해 주세요</option>
        {ROLES.map((role) => (
          <option key={role} value={role} disabled={role === other}>
            {ROLE_LABEL[role]}
            {role === other ? ' (다른 순위에서 선택함)' : ''}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export const OtherRoleInput: React.FC<{ value?: string; onChange: (value: string) => void; error?: string }> = ({ value = '', onChange, error }) => {
  const id = useId();
  return (
    <div className="max-w-sm">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        기타 역할 이름
      </label>
      <input
        id={id}
        value={value}
        maxLength={CARD_LIMITS.otherRoleText}
        onChange={(event) => onChange(event.target.value)}
        placeholder="예: QA, 테크니컬 라이터"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClassName(Boolean(error))}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

/* ── 가용성 ── */

export const WeeklyHoursChips: React.FC<{ value?: WeeklyHours; onChange: (value: WeeklyHours) => void }> = ({ value, onChange }) => (
  <RadioChips
    name="weekly-hours"
    options={WEEKLY_HOURS}
    labels={WEEKLY_HOURS_LABEL}
    value={value}
    onChange={onChange}
    icon={<ClockIcon className="h-4 w-4" aria-hidden="true" />}
  />
);

export const TimeSlotChips: React.FC<{ values: TimeSlot[]; onChange: (values: TimeSlot[]) => void }> = ({ values, onChange }) => (
  <CheckboxChips name="time-slots" options={TIME_SLOTS} labels={TIME_SLOT_LABEL} values={values} onChange={onChange} />
);

/* ── 목표 온도 ── */

const TEMPERATURES: GoalTemperature[] = [1, 2, 3, 4, 5];

export const GoalTemperatureScale: React.FC<{ value?: GoalTemperature; onChange: (value?: GoalTemperature) => void }> = ({ value, onChange }) => (
  <div>
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="w-14 shrink-0 text-xs font-medium text-muted sm:w-auto" aria-hidden="true">
        완주 지향
      </span>
      <div className="flex flex-1 justify-between gap-1.5 sm:flex-none sm:justify-start sm:gap-2">
        {TEMPERATURES.map((step) => {
          const checked = value === step;
          return (
            <label key={step} className="relative">
              <input
                type="radio"
                name="goal-temperature"
                value={step}
                checked={checked}
                onChange={() => onChange(step)}
                className="peer sr-only"
                aria-label={`${step}점${step === 1 ? ' 완주 지향' : step === 5 ? ' 수상 지향' : ''}`}
              />
              <span
                className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border text-sm font-bold tabular-nums transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
                  checked ? 'border-primary bg-primary text-on-primary' : 'border-outline bg-surface text-ink hover:bg-surface-container'
                }`}
                aria-hidden="true"
              >
                {step}
              </span>
            </label>
          );
        })}
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-medium text-muted sm:w-auto sm:text-left" aria-hidden="true">
        수상 지향
      </span>
    </div>
    {value !== undefined && (
      <button type="button" onClick={() => onChange(undefined)} className="mt-2 min-h-touch text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
        선택 지우기
      </button>
    )}
  </div>
);

/* ── 협업 스타일 ── */

export const WorkstyleChips: React.FC<{
  kind: 'prefer' | 'dislike';
  values: Workstyle[];
  opposite: Workstyle[];
  onChange: (values: Workstyle[]) => void;
}> = ({ kind, values, opposite, onChange }) => (
  <CheckboxChips
    name={`workstyle-${kind}`}
    options={WORKSTYLES}
    labels={WORKSTYLE_LABEL}
    values={values}
    onChange={onChange}
    // 선호와 기피에 같은 항목을 동시에 고를 수 없다.
    disabledOptions={opposite}
    max={CARD_LIMITS.workstyleMax}
  />
);

/* ── 기술 스택·강점 태그 ── */

const validateTag = (tag: string, current: string[]) => {
  if (tag.length < CARD_LIMITS.hashtagMin || tag.length > CARD_LIMITS.hashtagMax) return '태그는 2~20자로 입력해 주세요.';
  if (!HASHTAG_PATTERN.test(tag)) return '태그에는 한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요.';
  if (current.some((item) => item.toLowerCase() === tag.toLowerCase())) return '이미 추가한 태그예요.';
  if (current.length >= CARD_LIMITS.hashtagCount) return '태그는 20개까지 추가할 수 있어요.';
  return null;
};

export const HashtagField: React.FC<{ value: string[]; onChange: (value: string[]) => void }> = ({ value, onChange }) => {
  const inputId = useId();
  const helpId = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const keyword = draft.trim().replace(/^#/, '');

  useEffect(() => {
    if (!keyword) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      data.cards
        .searchHashtags(keyword)
        .then((result) => !cancelled && setSuggestions(result.filter((tag) => !value.includes(tag)).slice(0, 6)))
        .catch(() => !cancelled && setSuggestions([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword, value]);

  const add = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '');
    if (!tag) return;
    const problem = validateTag(tag, value);
    if (problem) {
      setError(problem);
      return;
    }
    onChange([...value, tag]);
    setDraft('');
    setError(null);
  };

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        태그 입력
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ',') && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add(draft);
            } else if (event.key === 'Backspace' && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder="예: React, SpringBoot"
          aria-describedby={helpId}
          aria-invalid={error ? true : undefined}
          className={fieldClassName(Boolean(error), 'flex-1')}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          className="inline-flex min-h-touch shrink-0 items-center rounded-[10px] border border-outline bg-surface px-4 text-sm font-semibold hover:bg-surface-container"
        >
          추가
        </button>
      </div>
      <p id={helpId} className={`mt-1.5 text-sm ${error ? 'text-danger' : 'text-muted'}`} aria-live="polite">
        {error ?? `Enter나 추가 버튼으로 넣어요. ${value.length}/${CARD_LIMITS.hashtagCount}개`}
      </p>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">다른 멤버가 쓴 태그</span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="min-h-[32px] rounded-full border border-outline-soft bg-surface px-2.5 text-sm hover:border-peri-300 hover:bg-peri-50"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="추가한 태그">
          {value.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-primary-container py-0.5 pl-3 pr-1 text-sm font-medium text-on-primary-container">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== tag))}
                aria-label={`${tag} 태그 삭제`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-peri-200"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── 글자 수 표시가 있는 입력 ── */

export const CountedTextArea: React.FC<{
  label: string;
  value?: string;
  max: number;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}> = ({ label, value = '', max, rows = 4, placeholder, onChange }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={max}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-count`}
        className={fieldClassName(false, 'leading-6')}
      />
      <p id={`${id}-count`} className="mt-1 text-right text-xs text-muted tabular-nums">
        {value.length}/{max}자
      </p>
    </div>
  );
};

export const PortfolioInput: React.FC<{ value?: string; onChange: (value: string) => void; error?: string }> = ({ value = '', onChange, error }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        포트폴리오 링크
      </label>
      <input
        id={id}
        name="portfolio"
        type="url"
        inputMode="url"
        value={value}
        maxLength={CARD_LIMITS.portfolio}
        placeholder="https://"
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClassName(Boolean(error))}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export const MbtiSelect: React.FC<{ value?: Mbti; onChange: (value?: Mbti) => void }> = ({ value, onChange }) => {
  const id = useId();
  return (
    <div className="max-w-xs">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        MBTI
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange((event.target.value || undefined) as Mbti | undefined)}
        aria-describedby={`${id}-help`}
        className={fieldClassName(false, 'appearance-auto')}
      >
        <option value="">선택 안 함 (카드에 표시 안 함)</option>
        {MBTI_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <p id={`${id}-help`} className="mt-1.5 text-sm text-muted">
        고르지 않으면 카드에 표시하지 않고 매칭에도 쓰지 않아요.
      </p>
    </div>
  );
};
