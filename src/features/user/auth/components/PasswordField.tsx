import React, { forwardRef, useState } from 'react';
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui';

type PasswordFieldProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'Icon'>;

/**
 * 비밀번호 입력: 보기 전환 버튼과 Caps Lock 안내를 제공합니다.
 * Caps Lock 안내는 입력에 포커스가 있을 때만 보이고 aria-live로 알립니다.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>((props, ref) => {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [focused, setFocused] = useState(false);
  const { onKeyDown, onKeyUp, onFocus, onBlur, ...rest } = props;

  const detect = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);
  };

  return (
    <div className="relative">
      <Input
        {...rest}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className="pr-12"
        onKeyDown={(event) => {
          detect(event);
          onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          detect(event);
          onKeyUp?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        aria-pressed={visible}
        className={`absolute right-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface-container hover:text-ink ${
          props.label ? 'top-[28px]' : 'top-0.5'
        }`}
      >
        {visible ? <EyeSlashIcon className="h-5 w-5" aria-hidden="true" /> : <EyeIcon className="h-5 w-5" aria-hidden="true" />}
      </button>
      <p aria-live="polite" className="text-sm">
        {focused && capsLock && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-warning">
            <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
            Caps Lock이 켜져 있어요
          </span>
        )}
      </p>
    </div>
  );
});

PasswordField.displayName = 'PasswordField';
