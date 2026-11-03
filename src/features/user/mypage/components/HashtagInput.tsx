import React, { useEffect, useId, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { fieldClassName } from '@/components/ui';
import { userApi } from '../api/userApi';
import { HASHTAG_PATTERN, PROFILE_LIMITS } from '../lib/profile';

interface HashtagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}

/** 서버 규칙(2–20자, 한글·영문·숫자·_, 최대 20개)을 입력 단계에서 안내합니다. */
const validateTag = (tag: string, current: string[]) => {
  if (tag.length < PROFILE_LIMITS.hashtagMin || tag.length > PROFILE_LIMITS.hashtagMax) return '태그는 2–20자로 입력해 주세요.';
  if (!HASHTAG_PATTERN.test(tag)) return '태그에는 한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요.';
  if (current.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return '이미 추가한 태그예요.';
  if (current.length >= PROFILE_LIMITS.hashtagCount) return '태그는 20개까지 추가할 수 있어요.';
  return null;
};

/**
 * 관심 태그 입력: Enter나 쉼표로 추가하고, 다른 사람이 쓴 태그를 추천으로 보여 줍니다.
 * 추천 검색에 실패해도 직접 입력은 그대로 할 수 있습니다.
 */
export const HashtagInput: React.FC<HashtagInputProps> = ({ value, onChange, label = '관심 태그' }) => {
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
    const timer = setTimeout(async () => {
      try {
        const result = await userApi.searchHashtags(keyword);
        if (!cancelled) setSuggestions(result.filter((tag) => !value.includes(tag)).slice(0, 6));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
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
    setSuggestions([]);
  };

  const remove = (tag: string) => onChange(value.filter((item) => item !== tag));

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        <span className="ml-1.5 font-normal text-muted tabular-nums">
          {value.length}/{PROFILE_LIMITS.hashtagCount}
        </span>
      </label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="추가한 태그">
          {value.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-primary-container py-0.5 pl-2.5 pr-1 text-sm font-medium text-on-primary-container">
              #{tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`${tag} 태그 삭제`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-peri-200"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
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
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder="예: 프론트엔드, 기획"
        aria-describedby={helpId}
        aria-invalid={error ? true : undefined}
        className={fieldClassName(Boolean(error))}
      />
      <p id={helpId} className={`mt-1.5 text-sm ${error ? 'text-danger' : 'text-muted'}`} aria-live="polite">
        {error ?? 'Enter나 쉼표로 추가해요. 멤버를 찾을 때 이 태그로 검색돼요.'}
      </p>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">다른 멤버가 쓴 태그</span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(tag)}
              className="min-h-[32px] rounded-full border border-outline-soft bg-surface px-2.5 text-sm text-ink hover:border-peri-300 hover:bg-peri-50"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
