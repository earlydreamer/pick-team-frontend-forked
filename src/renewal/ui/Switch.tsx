import React, { useId } from 'react';

/**
 * 켜기·끄기 스위치. `role=switch`와 `aria-checked`로 상태를 알리고 라벨·설명을 연결한다.
 * 상태는 위치와 색에 더해 화면 글자(켬·끔)로도 보여 준다. 꺼진 트랙은 흰 바탕과 3:1 이상 대비가 나는 neutral-500을 쓴다.
 */
export const Switch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled = false }) => {
  const id = useId();
  return (
    <div className="flex min-h-touch items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span id={`${id}-label`} className={`block text-sm font-semibold ${disabled ? 'text-muted' : ''}`}>
          {label}
        </span>
        {description && (
          <span id={`${id}-description`} className="block text-sm text-muted">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="group inline-flex min-h-touch shrink-0 items-center gap-2 rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
      >
        <span aria-hidden="true" className={`w-6 text-right text-xs font-semibold ${checked && !disabled ? 'text-primary' : 'text-muted'}`}>
          {checked ? '켬' : '끔'}
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            disabled ? 'bg-neutral-300' : checked ? 'bg-primary' : 'bg-neutral-500'
          }`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </span>
      </button>
    </div>
  );
};
