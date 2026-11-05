import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { AGREEMENT_ITEMS, type AgreementKey, type Agreements } from '@/renewal/domain/policy';

/**
 * 가입 동의(17 §6.2, 17-D6). 전체 동의와 항목별 동의를 함께 둔다.
 * 문서 링크는 새 탭에서 열어 입력 중인 가입 정보를 잃지 않게 한다. keys로 묻는 항목을 줄일 수 있다(개정 재동의).
 */
export const AgreementChecklist: React.FC<{ value: Agreements; onChange: (value: Agreements) => void; error?: string; keys?: AgreementKey[] }> = ({ value, onChange, error, keys }) => {
  const id = useId();
  const items = keys ? AGREEMENT_ITEMS.filter((item) => keys.includes(item.key)) : AGREEMENT_ITEMS;
  const all = items.every((item) => value[item.key]);
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined} className={`rounded-lg border p-3 ${error ? 'border-2 border-danger' : 'border-outline-soft'}`}>
      <legend className="px-1 text-sm font-semibold">약관 동의</legend>
      <label className="flex min-h-touch cursor-pointer items-center gap-2.5 border-b border-outline-soft pb-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="agree-all"
          className="h-4 w-4 accent-primary"
          checked={all}
          onChange={() => onChange({ ...value, ...Object.fromEntries(items.map((item) => [item.key, !all])) })}
        />
        모두 동의해요
      </label>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-x-2">
            <label className="flex min-h-touch cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name={`agree-${item.key}`}
                className="h-4 w-4 accent-primary"
                checked={value[item.key]}
                onChange={(event) => onChange({ ...value, [item.key]: event.target.checked })}
              />
              <span>
                <span className="font-semibold text-primary">(필수)</span> {item.label}
              </span>
            </label>
            {item.link && (
              <Link to={item.link.to} target="_blank" rel="noopener" className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink">
                {item.link.text}
                <span className="sr-only"> (새 탭)</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
};
