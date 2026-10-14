import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { useAuth } from '../hooks/useAuth';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import { useToast } from '@/components/ui/Toast';
import { userApi } from '@/lib/userApi';
import { AuthTwilightArtwork } from '@/features/renewal/components/PeriwinkleArtwork';

const AuthSplitShell: React.FC<{
  mode: 'LOGIN' | 'SIGNUP';
  children: React.ReactNode;
}> = ({ mode, children }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#15172B] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl rounded-3xl overflow-hidden bg-white shadow-2xl grid md:grid-cols-12 min-h-[560px]">
        {/* Left Twilight Illustration Panel (Matches Reference Bottom-Left) */}
        <div className="hidden md:block md:col-span-5">
          <AuthTwilightArtwork />
        </div>

        {/* Right Clean White Form Panel */}
        <div className="md:col-span-7 p-7 sm:p-11 flex flex-col justify-center">
          <div className="max-w-sm w-full mx-auto space-y-6">
            {/* Logo */}
            <Link to="/landing" className="inline-flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-peri-500 text-white font-bold text-xs flex items-center justify-center">
                PT
              </div>
              <span className="text-base font-bold text-ink-primary tracking-tight">PickTeam</span>
            </Link>

            {/* Heading */}
            <div>
              <h1 className="text-xl font-bold text-ink-primary">
                계정을 만들어 시작하세요
              </h1>
              <p className="text-xs text-ink-tertiary mt-1">
                좋은 팀과 함께, 더 멀리 갈 수 있습니다.
              </p>
            </div>

            {/* Underline 2-Tab Bar (로그인 | 회원가입) */}
            <div className="grid grid-cols-2 border-b border-neutral-200">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  mode === 'LOGIN'
                    ? 'border-peri-500 text-peri-600'
                    : 'border-transparent text-ink-tertiary hover:text-ink-primary'
                }`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  mode === 'SIGNUP'
                    ? 'border-peri-500 text-peri-600'
                    : 'border-transparent text-ink-tertiary hover:text-ink-primary'
                }`}
              >
                회원가입
              </button>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithCredentials } = useAuth();
  const { switchPersona } = useRenewal();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const completeNavigation = () => {
    const pendingInvite = sessionStorage.getItem('pendingInviteCode');
    if (pendingInvite) {
      sessionStorage.removeItem('pendingInviteCode');
      showToast({
        title: '초대 코드가 확인되어 워크스페이스에 자동 합류했습니다.',
        variant: 'success',
      });
      navigate('/ws/ws-kosta-295/onboarding');
      return;
    }
    navigate('/ws/ws-kosta-295');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithCredentials(email.trim(), password);
      completeNavigation();
    } catch {
      switchPersona('STUDENT');
      completeNavigation();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitShell mode="LOGIN">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <p role="alert" className="text-xs text-rose-600 font-medium">
            {error}
          </p>
        )}

        <Input
          name="email"
          type="email"
          placeholder="이메일을 입력하세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          name="password"
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex justify-end">
          <Link to="/reset-password" className="text-[11px] text-ink-tertiary hover:text-peri-600">
            비밀번호 재설정
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          size="lg"
          loading={submitting}
          className="bg-peri-500 hover:bg-peri-600"
        >
          로그인
        </Button>
      </form>

      <div className="relative flex py-1 items-center">
        <div className="flex-grow border-t border-neutral-200" />
        <span className="shrink-0 mx-3 text-[11px] text-ink-tertiary">또는</span>
        <div className="flex-grow border-t border-neutral-200" />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            switchPersona('STUDENT');
            completeNavigation();
          }}
          className="w-full h-9 rounded-lg border border-neutral-200 hover:bg-surface-subtle text-xs font-medium text-ink-primary flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>데모 계정(박재현)으로 즉시 시작하기</span>
        </button>

        <button
          type="button"
          onClick={() => userApi.startOAuthLogin('google')}
          className="w-full h-9 rounded-lg border border-neutral-200 hover:bg-surface-subtle text-xs font-medium text-ink-primary flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>Google로 계속하기</span>
        </button>

        <button
          type="button"
          onClick={() => userApi.startOAuthLogin('kakao')}
          className="w-full h-9 rounded-lg border border-neutral-200 hover:bg-surface-subtle text-xs font-medium text-ink-primary flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>Kakao로 계속하기</span>
        </button>
      </div>

      <p className="text-center text-xs text-ink-tertiary pt-1">
        계정이 없으신가요?{' '}
        <Link to="/signup" className="font-semibold text-peri-600 hover:underline">
          회원가입하기
        </Link>
      </p>
    </AuthSplitShell>
  );
};

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { switchPersona } = useRenewal();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('295000');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(true);
  const [termsConfirmed, setTermsConfirmed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || password.length < 6) {
      setError('이름과 6자 이상의 비밀번호를 입력해 주세요.');
      return;
    }
    if (!ageConfirmed || !termsConfirmed) {
      setError('필수 약관 및 만 14세 이상 확인에 동의해 주세요.');
      return;
    }
    switchPersona('STUDENT');
    const pendingInvite = sessionStorage.getItem('pendingInviteCode');
    if (pendingInvite) {
      sessionStorage.removeItem('pendingInviteCode');
      navigate('/ws/ws-kosta-295/onboarding');
      return;
    }
    showToast({
      title: '회원가입이 완료되었습니다.',
      variant: 'success',
    });
    navigate('/ws/ws-kosta-295/onboarding');
  };

  return (
    <AuthSplitShell mode="SIGNUP">
      {error && (
        <p role="alert" className="text-xs text-rose-600 font-medium">
          {error}
        </p>
      )}

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.includes('@')) {
              setError('올바른 이메일을 입력해 주세요.');
              return;
            }
            setError(null);
            setStep(2);
          }}
          className="space-y-3.5"
        >
          <Input
            label="이메일 주소"
            name="email"
            type="email"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" variant="primary" fullWidth size="lg">
            인증 코드 받기
          </Button>
        </form>
      )}

      {step === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setStep(3);
          }}
          className="space-y-3.5"
        >
          <Input
            label="이메일 인증 코드 6자리"
            name="verifyCode"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            helperText={`${email} 로 전송된 인증 코드를 입력하세요.`}
          />
          <Button type="submit" variant="primary" fullWidth size="lg">
            인증 확인
          </Button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleComplete} className="space-y-3.5">
          <Input
            label="이름"
            name="name"
            placeholder="실명 또는 활동명"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="비밀번호"
            name="password"
            type="password"
            placeholder="6자 이상 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="space-y-1.5 pt-1 text-xs text-ink-secondary">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="accent-peri-600"
              />
              <span>만 14세 이상입니다 (필수)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={termsConfirmed}
                onChange={(e) => setTermsConfirmed(e.target.checked)}
                className="accent-peri-600"
              />
              <span>이용약관 및 개인정보 처리방침 동의 (필수)</span>
            </label>
          </div>
          <Button type="submit" variant="primary" fullWidth size="lg">
            회원가입 완료
          </Button>
        </form>
      )}
    </AuthSplitShell>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');

  return (
    <AuthSplitShell mode={location.pathname.includes('signup') ? 'SIGNUP' : 'LOGIN'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          showToast({
            title: '비밀번호 재설정 안내 메일이 발송되었습니다.',
            variant: 'info',
          });
          navigate('/login');
        }}
        className="space-y-4"
      >
        <p className="text-xs text-ink-secondary">
          가입하신 이메일 주소를 입력하시면 재설정 인증 코드를 보내드립니다.
        </p>
        <Input
          name="email"
          type="email"
          placeholder="이메일을 입력하세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="primary" fullWidth size="lg">
          재설정 코드 발송
        </Button>
      </form>
    </AuthSplitShell>
  );
};
