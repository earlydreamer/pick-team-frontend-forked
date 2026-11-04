import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/context/AuthContext';
import { Button, Input } from '@/components/ui';
import { userApi } from '@/lib/userApi';
import { getErrorMessage, getErrorStatus } from '@/lib/errorMessage';
import { AuthLayout, FormMessage } from '../components/AuthLayout';
import { PasswordField } from '../components/PasswordField';
import { PasswordRules } from '../components/PasswordRules';
import { SocialLoginButtons, OrDivider } from '../components/SocialLoginButtons';
import { isPasswordValid, isValidEmail } from '../lib/passwordPolicy';

type FromState = { pathname?: string; search?: string } | undefined;
type AuthLocationState = { from?: FromState; email?: string; message?: string } | null;

const linkClass = 'font-semibold text-primary underline-offset-4 hover:underline';

/**
 * 로그인 후 돌아갈 경로. 보호된 화면에서 넘어왔으면 그 경로로,
 * 예전 형식의 ?inviteCode= 주소로 들어왔으면 초대 화면으로 보냅니다.
 */
const useReturnPath = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as AuthLocationState;
  const legacyInvite = searchParams.get('inviteCode');
  if (legacyInvite) return `/invite/${encodeURIComponent(legacyInvite)}`;
  const from = state?.from;
  return from?.pathname ? `${from.pathname}${from.search ?? ''}` : '/';
};

const inviteCodeFromPath = (path: string) => path.match(/^\/invite\/([^/?#]+)/)?.[1];

/** 초대 링크에서 넘어온 경우 폼 위에 맥락을 보여 줍니다. */
const InviteNotice: React.FC<{ returnPath: string; action: string }> = ({ returnPath, action }) =>
  inviteCodeFromPath(returnPath) ? (
    <FormMessage tone="info">워크스페이스 초대를 받았어요. {action} 초대 화면으로 돌아가요.</FormMessage>
  ) : null;

const startOAuth = (provider: 'google' | 'kakao', returnPath: string, isSignup: boolean, onError: (message: string) => void) => {
  try {
    const inviteCode = inviteCodeFromPath(returnPath);
    if (inviteCode) sessionStorage.setItem('pendingInviteCode', decodeURIComponent(inviteCode));
    if (isSignup) sessionStorage.setItem('isOAuthSignup', 'true');
    userApi.startOAuthLogin(provider);
  } catch (error) {
    onError(getErrorMessage(error, '간편 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }
};

/* ───────────────────────── 로그인 ───────────────────────── */

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as AuthLocationState;
  const navigate = useNavigate();
  const auth = useAuth();
  const returnPath = useReturnPath();

  const [email, setEmail] = useState(state?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // 회원가입·비밀번호 재설정에서 이메일을 채워 넘어오면 비밀번호 입력으로 바로 이동합니다.
  useEffect(() => {
    if (state?.email) passwordRef.current?.focus();
  }, [state?.email]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError('이메일 주소 형식을 확인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await auth.loginWithCredentials(email.trim(), password);
      sessionStorage.removeItem('hasRedirectedFromRoot');
      navigate(returnPath, { replace: true });
    } catch (err) {
      const status = getErrorStatus(err);
      setError(
        status === 401 || status === 400
          ? '이메일 또는 비밀번호가 맞지 않아요.'
          : getErrorMessage(err, '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'),
      );
      auth.setError(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="로그인"
      description="워크스페이스와 팀으로 돌아가요."
      notice={
        state?.message ? (
          <FormMessage tone="success">{state.message}</FormMessage>
        ) : (
          <InviteNotice returnPath={returnPath} action="로그인하면" />
        )
      }
      footer={
        <>
          <p>
            처음이신가요?{' '}
            <Link to="/signup" state={location.state} className={linkClass}>
              회원가입
            </Link>
          </p>
          <p>
            <Link to="/forgot-password" state={{ email }} className={linkClass}>
              비밀번호를 잊었어요
            </Link>
          </p>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <Input
          label="이메일"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          ref={passwordRef}
          label="비밀번호"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          로그인
        </Button>
      </form>
      <OrDivider />
      <SocialLoginButtons verb="로그인" onSelect={(provider) => startOAuth(provider, returnPath, false, setError)} />
    </AuthLayout>
  );
};

/* ───────────────────────── 회원가입 ───────────────────────── */

const RESEND_SECONDS = 60;

const useCooldown = () => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, () => setSeconds(RESEND_SECONDS)] as const;
};

const StepIndicator: React.FC<{ steps: string[]; current: number }> = ({ steps, current }) => (
  <ol className="mb-6 flex items-center gap-2" aria-label="진행 단계">
    {steps.map((label, index) => {
      const state = index < current ? 'done' : index === current ? 'current' : 'todo';
      return (
        <li key={label} className="flex flex-1 flex-col gap-1.5" aria-current={state === 'current' ? 'step' : undefined}>
          <span
            className={`h-1 rounded-full ${state === 'todo' ? 'bg-surface-container' : 'bg-primary'}`}
            aria-hidden="true"
          />
          <span className={`text-xs ${state === 'current' ? 'font-semibold text-ink' : 'text-muted'}`}>
            {index + 1}. {label}
            {state === 'done' && <span className="sr-only"> (완료)</span>}
          </span>
        </li>
      );
    })}
  </ol>
);

export const SignupPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const returnPath = useReturnPath();

  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pending, setPending] = useState<'send' | 'verify' | null>(null);
  const [cooldown, startCooldown] = useCooldown();
  const codeRef = useRef<HTMLInputElement>(null);

  const emailError = touched && !isValidEmail(email) ? '이메일 주소 형식을 확인해 주세요.' : undefined;
  const passwordError = touched && !isPasswordValid(password, 'signup') ? '아래 조건을 모두 채워 주세요.' : undefined;
  const confirmError = touched && confirmPassword !== password ? '비밀번호가 서로 달라요.' : undefined;

  useEffect(() => {
    if (step === 'verify') codeRef.current?.focus();
  }, [step]);

  const sendCode = async () => {
    setError('');
    setPending('send');
    try {
      await userApi.requestEmailVerification(email.trim());
      startCooldown();
      setStep('verify');
      setInfo(`${email.trim()}로 6자리 인증 코드를 보냈어요.`);
    } catch (err) {
      setError(
        getErrorStatus(err) === 409
          ? '이미 가입된 이메일이에요. 로그인하거나 비밀번호를 재설정해 주세요.'
          : getErrorMessage(err, '인증 코드를 보내지 못했어요. 잠시 후 다시 시도해 주세요.'),
      );
    } finally {
      setPending(null);
    }
  };

  const handleDetailsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!isValidEmail(email) || !isPasswordValid(password, 'signup') || confirmPassword !== password) return;
    await sendCode();
  };

  // 인증이 확인되면 이어서 가입을 완료합니다(입력한 정보로 가입한다는 의사는 이미 받았어요).
  const handleVerifySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('메일로 받은 6자리 숫자를 입력해 주세요.');
      return;
    }
    setPending('verify');
    try {
      const response = await userApi.verifyEmail(email.trim(), code);
      if (response.data !== true) {
        setError('인증 코드가 맞지 않아요. 메일의 코드를 다시 확인해 주세요.');
        return;
      }
      await auth.register({ email: email.trim(), password, confirmPassword, name: email.trim().split('@')[0] });
      navigate('/login', {
        replace: true,
        state: { email: email.trim(), message: '가입을 마쳤어요. 로그인해 주세요.', from: (location.state as AuthLocationState)?.from },
      });
    } catch (err) {
      const status = getErrorStatus(err);
      setError(
        status === 410
          ? '인증 코드가 만료됐어요. 코드를 다시 받아 주세요.'
          : status === 400
            ? '인증 코드가 맞지 않아요. 메일의 코드를 다시 확인해 주세요.'
            : getErrorMessage(err, '가입하지 못했어요. 잠시 후 다시 시도해 주세요.'),
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <AuthLayout
      title="회원가입"
      description="이메일로 가입하고 프로필은 가입 후에 채워요."
      notice={<InviteNotice returnPath={returnPath} action="가입하고 로그인하면" />}
      footer={
        <p>
          이미 계정이 있나요?{' '}
          <Link to="/login" state={location.state} className={linkClass}>
            로그인
          </Link>
        </p>
      }
    >
      <StepIndicator steps={['정보 입력', '이메일 인증']} current={step === 'details' ? 0 : 1} />

      {step === 'details' ? (
        <>
          <form className="space-y-4" onSubmit={handleDetailsSubmit} noValidate>
            {error && <FormMessage tone="error">{error}</FormMessage>}
            <Input
              label="이메일"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              error={emailError}
              onChange={(event) => setEmail(event.target.value)}
            />
            <div>
              <PasswordField
                label="비밀번호"
                name="new-password"
                autoComplete="new-password"
                required
                value={password}
                error={passwordError}
                aria-describedby="signup-password-rules"
                onChange={(event) => setPassword(event.target.value)}
              />
              <PasswordRules id="signup-password-rules" value={password} policy="signup" />
            </div>
            <PasswordField
              label="비밀번호 확인"
              name="confirm-password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              error={confirmError}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" size="lg" className="w-full" loading={pending === 'send'}>
              인증 코드 받기
            </Button>
          </form>
          <OrDivider />
          <SocialLoginButtons verb="시작하기" onSelect={(provider) => startOAuth(provider, returnPath, true, setError)} />
        </>
      ) : (
        <form className="space-y-4" onSubmit={handleVerifySubmit} noValidate>
          {error ? <FormMessage tone="error">{error}</FormMessage> : info && <FormMessage tone="info">{info}</FormMessage>}
          <Input
            ref={codeRef}
            label="인증 코드"
            name="verification-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            help="메일이 보이지 않으면 스팸함을 확인해 주세요."
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="tracking-[0.3em] tabular-nums"
          />
          <Button type="submit" size="lg" className="w-full" loading={pending === 'verify'}>
            인증하고 가입하기
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              className={`${linkClass} min-h-touch disabled:cursor-not-allowed disabled:text-neutral-500 disabled:no-underline`}
              onClick={sendCode}
              disabled={cooldown > 0 || pending !== null}
            >
              {cooldown > 0 ? `코드 다시 받기 (${cooldown}초)` : '코드 다시 받기'}
            </button>
            <button
              type="button"
              className="min-h-touch font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
              onClick={() => {
                setStep('details');
                setCode('');
                setError('');
                setInfo('');
              }}
            >
              이메일 바꾸기
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

/* ───────────────────────── 비밀번호 재설정 ───────────────────────── */

export const ForgotPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = (location.state as AuthLocationState)?.email ?? '';

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, startCooldown] = useCooldown();
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) codeRef.current?.focus();
    if (step === 2) passwordRef.current?.focus();
  }, [step]);

  const run = async (task: () => Promise<void>, fallback: string) => {
    setError('');
    setLoading(true);
    try {
      await task();
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = () =>
    run(async () => {
      await userApi.sendPasswordResetEmail({ email: email.trim() });
      startCooldown();
      setStep(1);
      setInfo(`${email.trim()}로 6자리 재설정 코드를 보냈어요.`);
    }, '재설정 코드를 보내지 못했어요. 가입한 이메일인지 확인해 주세요.');

  const handleEmail = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError('이메일 주소 형식을 확인해 주세요.');
      return;
    }
    sendEmail();
  };

  const handleCode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('메일로 받은 6자리 숫자를 입력해 주세요.');
      return;
    }
    run(async () => {
      const response = await userApi.verifyResetCode({ email: email.trim(), resetCode: code });
      if (response.data.valid) {
        setInfo('');
        setStep(2);
      } else {
        setError(response.data.message || '재설정 코드가 맞지 않아요.');
      }
    }, '재설정 코드를 확인하지 못했어요. 다시 시도해 주세요.');
  };

  const handlePassword = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!isPasswordValid(newPassword, 'reset') || newPassword !== confirmPassword) return;
    run(async () => {
      await userApi.resetPassword({ email: email.trim(), resetCode: code, newPassword });
      navigate('/login', { replace: true, state: { email: email.trim(), message: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.' } });
    }, '비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.');
  };

  const descriptions = [
    '가입한 이메일로 재설정 코드를 보내 드려요.',
    '메일로 받은 코드를 입력해 주세요.',
    '새로 사용할 비밀번호를 정해 주세요.',
  ];

  return (
    <AuthLayout
      title="비밀번호 재설정"
      description={descriptions[step]}
      footer={
        <p>
          비밀번호가 기억났나요?{' '}
          <Link to="/login" state={{ email }} className={linkClass}>
            로그인
          </Link>
        </p>
      }
    >
      <StepIndicator steps={['이메일', '코드 확인', '새 비밀번호']} current={step} />
      {error ? <FormMessage tone="error">{error}</FormMessage> : info && <FormMessage tone="info">{info}</FormMessage>}

      {step === 0 && (
        <form className="mt-4 space-y-4" onSubmit={handleEmail} noValidate>
          <Input
            label="이메일"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            재설정 코드 받기
          </Button>
        </form>
      )}

      {step === 1 && (
        <form className="mt-4 space-y-4" onSubmit={handleCode} noValidate>
          <Input
            ref={codeRef}
            label="재설정 코드"
            name="reset-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="tracking-[0.3em] tabular-nums"
          />
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            코드 확인
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              className={`${linkClass} min-h-touch disabled:cursor-not-allowed disabled:text-neutral-500 disabled:no-underline`}
              onClick={sendEmail}
              disabled={cooldown > 0 || loading}
            >
              {cooldown > 0 ? `코드 다시 받기 (${cooldown}초)` : '코드 다시 받기'}
            </button>
            <button
              type="button"
              className="min-h-touch font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
              onClick={() => {
                setStep(0);
                setCode('');
                setError('');
                setInfo('');
              }}
            >
              이메일 바꾸기
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form className="mt-4 space-y-4" onSubmit={handlePassword} noValidate>
          <div>
            <PasswordField
              ref={passwordRef}
              label="새 비밀번호"
              name="new-password"
              autoComplete="new-password"
              required
              value={newPassword}
              error={touched && !isPasswordValid(newPassword, 'reset') ? '아래 조건을 모두 채워 주세요.' : undefined}
              aria-describedby="reset-password-rules"
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <PasswordRules id="reset-password-rules" value={newPassword} policy="reset" />
          </div>
          <PasswordField
            label="새 비밀번호 확인"
            name="confirm-password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            error={touched && confirmPassword !== newPassword ? '비밀번호가 서로 달라요.' : undefined}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            비밀번호 바꾸기
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};
