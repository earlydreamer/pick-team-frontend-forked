import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OAUTH_LABEL, type OAuthProvider } from '@/renewal/domain/auth';
import { data } from '@/renewal/data';
import { LoadingState, buttonClassName } from '@/renewal/ui';
import { AuthLayout, FormError } from './AuthUi';
import { useCompleteAuth } from './useCompleteAuth';

const isProvider = (value: string | null): value is OAuthProvider => value === 'google' || value === 'kakao';

/**
 * OAuth 콜백. 제공자가 돌려준 임시 코드를 교환해 로그인하고, 이메일 가입과 같은 경로로 초대 합류를 이어 간다(10 §5.2).
 * As-Is OAuthCallbackPage가 초대 코드를 읽고 버리던 부분을 useCompleteAuth로 완성한다.
 */
export const OAuthCallbackScreen: React.FC = () => {
  const [params] = useSearchParams();
  const complete = useCompleteAuth();
  const [error, setError] = useState<string>();
  const started = useRef(false);
  const provider = params.get('provider');
  const code = params.get('code');

  useEffect(() => {
    // StrictMode의 이중 실행으로 임시 코드를 두 번 교환하지 않게 한다.
    if (started.current) return;
    started.current = true;
    if (!isProvider(provider) || !code) {
      setError('로그인 정보가 올바르지 않아요. 다시 시도해 주세요.');
      return;
    }
    data.session
      .oauthExchange(provider, code)
      .then(complete)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '로그인하지 못했어요. 다시 시도해 주세요.'));
  }, [provider, code, complete]);

  if (!error) return <LoadingState className="min-h-screen" label={`${isProvider(provider) ? OAUTH_LABEL[provider] : ''} 로그인을 마무리하는 중이에요`} />;
  return (
    <AuthLayout title="로그인하지 못했어요">
      <FormError message={error} />
      <Link to="/login" className={buttonClassName('primary', 'md', 'w-full')}>
        로그인 화면으로
      </Link>
    </AuthLayout>
  );
};
