import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CODE_PATTERN, isPasswordValid, isValidEmail, validateName } from '@/renewal/domain/auth';
import { DataError, data } from '@/renewal/data';
import { peekMockCode } from '@/renewal/data/mock/adapters';
import { Button, Input } from '@/renewal/ui';
import { AuthLayout, CodeField, FormError, MockHint, OAuthButtons, PasswordChecklist, PasswordField, StepIndicator, useStepFocus } from './AuthUi';
import { InviteNotice, withRedirect } from './LoginScreen';
import { useCompleteAuth } from './useCompleteAuth';

const STEPS = ['이메일', '인증', '계정 정보'];
const messageOf = (error: unknown) => (error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.');

/**
 * SCR-AUTH-02 가입(10 §4.2). 이메일 입력, 코드 인증, 이름·비밀번호 입력의 3단계다.
 * 기획은 3단계에서 닉네임을 받는다. 백엔드 SignupRequest에는 이름 필드가 없어 http 어댑터 연결 때 맞춰야 한다.
 */
export const SignupScreen: React.FC = () => {
  const [params] = useSearchParams();
  const complete = useCompleteAuth();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(0);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; name?: string; password?: string; confirm?: string; form?: string }>({});
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const stepRef = useStepFocus(step);

  const sendCode = async () => {
    await data.session.requestSignupCode(email.trim());
    setSentAt(Date.now());
    setCode('');
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setConflict(false);
    if (!isValidEmail(email)) {
      setErrors({ email: '이메일 형식을 확인해 주세요.' });
      return firstFieldRef.current?.focus();
    }
    setPending(true);
    try {
      await sendCode();
      setErrors({});
      setStep(1);
    } catch (error) {
      setConflict(error instanceof DataError && error.code === 'CONFLICT');
      setErrors({ email: messageOf(error) });
      firstFieldRef.current?.focus();
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
      await data.session.verifySignupCode(email.trim(), code);
      setErrors({});
      setStep(2);
    } catch (error) {
      setErrors({ code: messageOf(error) });
    } finally {
      setPending(false);
    }
  };

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    found.name = validateName(name);
    if (!isPasswordValid(password, 'signup')) found.password = '비밀번호 조건을 모두 채워 주세요.';
    if (password !== confirm) found.confirm = '비밀번호가 서로 달라요.';
    setErrors(found);
    const firstError = (['name', 'password', 'confirm'] as const).find((key) => found[key]);
    if (firstError) return document.getElementsByName(firstError)[0]?.focus();
    setPending(true);
    try {
      complete(await data.session.signUp({ email: email.trim(), name: name.trim(), password }));
    } catch (error) {
      setErrors({ form: messageOf(error) });
    } finally {
      setPending(false);
    }
  };

  const mockCode = step === 1 ? peekMockCode(email, 'SIGNUP') : undefined;

  return (
    <AuthLayout
      title="가입하기"
      footer={
        <>
          이미 계정이 있나요?{' '}
          <Link to={withRedirect('/login', params)} className="font-semibold text-primary underline-offset-4 hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <StepIndicator steps={STEPS} current={step} />
      <InviteNotice verb="가입" />
      <FormError message={errors.form} />

      <div ref={stepRef}>
      {step === 0 && (
        <>
          <form onSubmit={submitEmail} noValidate className="space-y-4">
            <Input
              ref={firstFieldRef}
              label="이메일"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              help="이 주소로 인증 코드를 보내요."
            />
            {conflict && (
              <p className="text-sm">
                <Link to={withRedirect('/login', params)} className="font-semibold text-primary underline underline-offset-4">
                  로그인으로 이동
                </Link>
              </p>
            )}
            <Button type="submit" className="w-full" loading={pending}>
              인증 코드 받기
            </Button>
          </form>
          <OAuthButtons verb="가입" />
        </>
      )}

      {step === 1 && (
        <form onSubmit={submitCode} noValidate className="space-y-4">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{email.trim()}</span>로 코드를 보냈어요.{' '}
            <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => setStep(0)}>
              이메일 바꾸기
            </button>
          </p>
          <CodeField value={code} onChange={setCode} sentAt={sentAt} error={errors.code} resendPending={resending} onResend={resend} />
          {mockCode && <MockHint>인증 코드는 {mockCode}예요.</MockHint>}
          <Button type="submit" className="w-full" loading={pending}>
            확인
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitAccount} noValidate className="space-y-4">
          <Input label="이름" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} help="팀원에게 보이는 이름이에요. 2~50자로 입력해 주세요." />
          <div>
            <PasswordField
              label="비밀번호"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              aria-describedby="signup-password-rules"
            />
            <PasswordChecklist id="signup-password-rules" value={password} policy="signup" />
          </div>
          <PasswordField
            label="비밀번호 확인"
            name="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={errors.confirm}
          />
          <Button type="submit" className="w-full" loading={pending}>
            가입 완료
          </Button>
        </form>
      )}
      </div>
    </AuthLayout>
  );
};
