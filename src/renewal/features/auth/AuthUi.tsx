import React, { forwardRef, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CODE_TTL_MS, OAUTH_LABEL, passwordRules, safeRedirect, type OAuthProvider, type PasswordPolicy } from '@/renewal/domain/auth';
import { savePendingRedirect } from './pendingInvite';
import { data } from '@/renewal/data';
import { Badge, Button, Input } from '@/renewal/ui';
import { BrandLockup } from '@/renewal/shell/BrandMark';

/** 인증 화면 틀(10 §4). 셸 없이 가운데 카드 하나로 보여 준다. */
export const AuthLayout: React.FC<{ title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }> = ({
  title,
  description,
  children,
  footer,
}) => (
  <div className="flex min-h-screen flex-col items-center bg-surface-low px-4 py-10 sm:justify-center">
    <div className="mb-6 flex items-center gap-2">
      <Link to="/" aria-label="Pick Team 첫 화면">
        <BrandLockup />
      </Link>
      {data.kind === 'mock' && <Badge tone="warning">목업 데이터</Badge>}
    </div>
    <main className="w-full max-w-md rounded-modal border border-outline-soft bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold leading-8">{title}</h1>
      {description && <p className="mt-1.5 text-[0.9375rem] leading-6 text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </main>
    {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
  </div>
);

/** 폼 전체 오류. 화면 읽기 프로그램이 바로 읽도록 alert로 알린다. */
export const FormError: React.FC<{ message?: string; children?: React.ReactNode }> = ({ message, children }) =>
  message ? (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger">
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {message}
        {children}
      </span>
    </div>
  ) : null;

/** 목업 전용 안내(시드 계정, 발송한 인증 코드). 실제 데이터에서는 그리지 않는다. */
export const MockHint: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  data.kind === 'mock' ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-warning">목업 안내: {children}</p> : null;

type PasswordFieldProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'Icon'>;

/** 비밀번호 입력: 보기 전환과 Caps Lock 안내를 제공한다. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>((props, ref) => {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const { onKeyUp, onBlur, ...rest } = props;
  return (
    <div className="relative">
      <Input
        {...rest}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className="pr-12"
        onKeyUp={(event) => {
          setCapsLock(event.getModifierState?.('CapsLock') ?? false);
          onKeyUp?.(event);
        }}
        onBlur={(event) => {
          setCapsLock(false);
          onBlur?.(event);
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        aria-pressed={visible}
        className={`absolute right-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface-container hover:text-ink ${props.label ? 'top-[30px]' : 'top-0.5'}`}
      >
        {visible ? <EyeSlashIcon className="h-5 w-5" aria-hidden="true" /> : <EyeIcon className="h-5 w-5" aria-hidden="true" />}
      </button>
      <p aria-live="polite" className="text-sm">
        {capsLock && (
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

/** 비밀번호 조건 목록. 조건마다 충족 여부를 아이콘과 글자로 함께 알린다. */
export const PasswordChecklist: React.FC<{ id: string; value: string; policy: PasswordPolicy }> = ({ id, value, policy }) => (
  <ul id={id} className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label="비밀번호 조건">
    {passwordRules(policy).map((rule) => {
      const ok = rule.test(value);
      return (
        <li key={rule.id} className={`flex items-center gap-1 ${ok ? 'text-success' : 'text-muted'}`}>
          {ok ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          {rule.label}
          <span className="sr-only">{ok ? '충족' : '미충족'}</span>
        </li>
      );
    })}
  </ul>
);

const format = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * 인증 코드 입력(숫자 6자리)과 남은 시간. 5분이 지나면 만료를 알리고 다시 받기를 권한다(10 §5.3).
 * 남은 시간은 매초 읽어 주지 않도록 aria-live를 쓰지 않고, 만료 순간만 상태 문구로 알린다.
 */
export const CodeField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  sentAt: number;
  error?: string;
  resendPending: boolean;
  onResend: () => void;
}> = ({ value, onChange, sentAt, error, resendPending, onResend }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const left = sentAt + CODE_TTL_MS - now;
  const expired = left <= 0;
  return (
    <div>
      <Input
        label="인증 코드"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        error={error}
        help="메일로 받은 숫자 6자리를 입력해 주세요."
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        {expired ? (
          <p role="status" className="font-semibold text-danger">
            코드가 만료됐어요. 다시 받아 주세요.
          </p>
        ) : (
          <p className="text-muted tabular-nums">남은 시간 {format(left)}</p>
        )}
        <Button type="button" size="sm" variant="ghost" loading={resendPending} onClick={onResend}>
          코드 다시 받기
        </Button>
      </div>
    </div>
  );
};

const providerStyle: Record<OAuthProvider, string> = {
  google: 'bg-surface text-ink border border-outline hover:bg-surface-container',
  kakao: 'bg-[#FEE500] text-[#191600] border border-transparent hover:brightness-95',
};

/** OAuth 시작 버튼. 제공자 인증 화면으로 이동한다(목업은 바로 콜백으로 돌아온다). 떠나기 전에 ?redirect= 목적지를 보존한다. */
export const OAuthButtons: React.FC<{ verb: '로그인' | '가입' }> = ({ verb }) => {
  const [params] = useSearchParams();
  return (
  <div>
    <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-outline-soft" />
      또는
      <span className="h-px flex-1 bg-outline-soft" />
    </div>
    <div className="grid gap-2">
      {(['google', 'kakao'] as const).map((provider) => (
        <a
          key={provider}
          href={data.session.oauthStartUrl(provider)}
          onClick={() => savePendingRedirect(safeRedirect(params.get('redirect')))}
          className={`inline-flex min-h-touch items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition ${providerStyle[provider]}`}
        >
          {OAUTH_LABEL[provider]}로 {verb}
        </a>
      ))}
    </div>
  </div>
  );
};

/** 단계 표시(가입·비밀번호 재설정 3단계). */
export const StepIndicator: React.FC<{ steps: string[]; current: number }> = ({ steps, current }) => (
  <ol className="mb-6 flex gap-2" aria-label="진행 단계">
    {steps.map((label, index) => {
      const state = index < current ? 'done' : index === current ? 'current' : 'todo';
      return (
        <li key={label} className="flex-1" aria-current={state === 'current' ? 'step' : undefined}>
          <span className={`block h-1.5 rounded-full ${state === 'todo' ? 'bg-surface-container' : 'bg-primary'}`} aria-hidden="true" />
          <span className={`mt-1.5 block text-xs ${state === 'current' ? 'font-semibold text-ink' : 'text-muted'}`}>
            {index + 1}. {label}
            {state === 'done' && <span className="sr-only"> (완료)</span>}
          </span>
        </li>
      );
    })}
  </ol>
);

/** 단계가 바뀌면 새 단계의 첫 입력으로 포커스를 옮긴다. 첫 진입에서는 옮기지 않는다. */
export const useStepFocus = (step: number) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [step]);
  return ref;
};
