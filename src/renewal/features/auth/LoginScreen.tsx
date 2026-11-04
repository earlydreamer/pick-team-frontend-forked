import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isValidEmail } from '@/renewal/domain/auth';
import { data } from '@/renewal/data';
import { useInvite } from '@/renewal/data/queries';
import { Button, Input } from '@/renewal/ui';
import { MOCK_PASSWORD } from '@/renewal/data/mock/db';
import { AuthLayout, FormError, MockHint, OAuthButtons, PasswordField } from './AuthUi';
import { readPendingInvite } from './pendingInvite';
import { useCompleteAuth } from './useCompleteAuth';

/** 초대를 거쳐 왔으면 어디에 합류하는지 알려 준다. */
export const InviteNotice: React.FC<{ verb: string }> = ({ verb }) => {
  const code = readPendingInvite() ?? '';
  const invite = useInvite(code);
  if (!invite.data) return null;
  return (
    <p className="mb-5 rounded-lg bg-peri-50 px-3 py-2.5 text-sm leading-6">
      <span className="font-semibold">{invite.data.workspaceName}</span>에 초대받았어요. {verb}하면 바로 합류해요.
    </p>
  );
};

/** 다른 인증 화면으로 옮겨 갈 때 원래 목적지를 함께 넘긴다. */
export const withRedirect = (path: string, params: URLSearchParams) => {
  const redirect = params.get('redirect');
  return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
};

/**
 * SCR-AUTH-01 로그인(10 §4.1). 오류는 alert() 대신 폼 위에 인라인으로 보여 주고,
 * 계정 존재 여부가 드러나지 않도록 이메일과 비밀번호 오류를 한 문구로 알린다.
 */
export const LoginScreen: React.FC = () => {
  const [params] = useSearchParams();
  const complete = useCompleteAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (!isValidEmail(email)) found.email = '이메일 형식을 확인해 주세요.';
    if (!password) found.password = '비밀번호를 입력해 주세요.';
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    setPending(true);
    try {
      complete(await data.session.signIn(email.trim(), password));
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : '로그인하지 못했어요. 다시 시도해 주세요.' });
      passwordRef.current?.focus();
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="로그인"
      footer={
        <>
          계정이 없나요?{' '}
          <Link to={withRedirect('/signup', params)} className="font-semibold text-primary underline-offset-4 hover:underline">
            가입하기
          </Link>
        </>
      }
    >
      <InviteNotice verb="로그인" />
      <FormError message={errors.form} />
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input ref={emailRef} label="이메일" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} />
        <PasswordField
          ref={passwordRef}
          label="비밀번호"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <div className="flex justify-end">
          <Link to="/reset-password" className="inline-flex min-h-touch items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
            비밀번호를 잊었나요?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={pending}>
          로그인
        </Button>
      </form>
      <MockHint>
        시드 계정은 user1@example.com(김수강)부터 user15@example.com까지이고, 비밀번호는 모두 {MOCK_PASSWORD}예요.
      </MockHint>
      <OAuthButtons verb="로그인" />
    </AuthLayout>
  );
};
