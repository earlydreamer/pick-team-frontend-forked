import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { CODE_PATTERN, isPasswordValid, isValidEmail } from '@/renewal/domain/auth';
import { DataError, data } from '@/renewal/data';
import { peekMockCode } from '@/renewal/data/mock/adapters';
import { Button, Input, buttonClassName } from '@/renewal/ui';
import { AuthLayout, CodeField, FormError, MockHint, PasswordChecklist, PasswordField, StepIndicator, useStepFocus } from './AuthUi';

const STEPS = ['이메일', '인증', '새 비밀번호'];
const messageOf = (error: unknown) => (error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.');

/**
 * SCR-AUTH-03 비밀번호 재설정(10 §4.3). 이메일, 코드 확인, 새 비밀번호의 3단계다.
 * 가입된 이메일인지 드러내지 않도록 코드 발송은 항상 같은 안내로 끝낸다.
 * 새 비밀번호 조건은 백엔드 PasswordResetDto를 따르며 가입 조건과 다르다.
 */
export const ResetPasswordScreen: React.FC = () => {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(0);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string; confirm?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const stepRef = useStepFocus(step);

  const sendCode = async () => {
    await data.session.requestPasswordReset(email.trim());
    setSentAt(Date.now());
    setCode('');
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setErrors({ email: '이메일 형식을 확인해 주세요.' });
      return emailRef.current?.focus();
    }
    setPending(true);
    try {
      await sendCode();
      setErrors({});
      setStep(1);
    } catch (error) {
      setErrors({ email: messageOf(error) });
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await sendCode();
      setErrors({});
    } catch (error) {
      setErrors({ form: messageOf(error) });
    } finally {
      setResending(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!CODE_PATTERN.test(code)) {
      setErrors({ code: '숫자 6자리를 입력해 주세요.' });
      return;
    }
    setPending(true);
    try {
      await data.session.verifyResetCode(email.trim(), code);
      setErrors({});
      setStep(2);
    } catch (error) {
      setErrors({ code: messageOf(error) });
    } finally {
      setPending(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (!isPasswordValid(password, 'reset')) found.password = '비밀번호 조건을 모두 채워 주세요.';
    if (password !== confirm) found.confirm = '비밀번호가 서로 달라요.';
    setErrors(found);
    const firstError = (['password', 'confirm'] as const).find((key) => found[key]);
    if (firstError) return document.getElementsByName(firstError)[0]?.focus();
    setPending(true);
    try {
      await data.session.resetPassword(email.trim(), code, password);
      setDone(true);
    } catch (error) {
      // 코드가 만료됐거나 이미 쓰였으면 코드 단계로 돌아가 다시 받게 한다.
      if (error instanceof DataError && (error.code === 'GONE' || error.code === 'INVALID')) {
        setStep(1);
        setErrors({ code: messageOf(error) });
      } else {
        setErrors({ form: messageOf(error) });
      }
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="비밀번호를 바꿨어요">
        <p role="status" className="flex items-start gap-2 text-[0.9375rem] leading-6">
          <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />새 비밀번호로 로그인해 주세요.
        </p>
        <Link to="/login" className={buttonClassName('primary', 'md', 'mt-6 w-full')}>
          로그인하기
        </Link>
      </AuthLayout>
    );
  }

  const mockCode = step === 1 ? peekMockCode(email, 'RESET') : undefined;

  return (
    <AuthLayout
      title="비밀번호 재설정"
      footer={
        <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          로그인으로 돌아가기
        </Link>
      }
    >
      <StepIndicator steps={STEPS} current={step} />
      <FormError message={errors.form} />
      <div ref={stepRef}>
        {step === 0 && (
          <form onSubmit={submitEmail} noValidate className="space-y-4">
            <Input ref={emailRef} label="가입한 이메일" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} />
            <Button type="submit" className="w-full" loading={pending}>
              재설정 코드 받기
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={submitCode} noValidate className="space-y-4">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{email.trim()}</span>이 가입된 이메일이면 재설정 코드를 보냈어요. 메일이 오지 않으면 주소를 확인해 주세요.
            </p>
            <CodeField value={code} onChange={setCode} sentAt={sentAt} error={errors.code} resendPending={resending} onResend={resend} />
            {mockCode ? <MockHint>재설정 코드는 {mockCode}예요.</MockHint> : <MockHint>가입되지 않은 이메일이라 코드를 만들지 않았어요.</MockHint>}
            <Button type="submit" className="w-full" loading={pending}>
              확인
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitPassword} noValidate className="space-y-4">
            <div>
              <PasswordField
                label="새 비밀번호"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
                aria-describedby="reset-password-rules"
              />
              <PasswordChecklist id="reset-password-rules" value={password} policy="reset" />
            </div>
            <PasswordField label="새 비밀번호 확인" name="confirm" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} error={errors.confirm} />
            <Button type="submit" className="w-full" loading={pending}>
              비밀번호 바꾸기
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
