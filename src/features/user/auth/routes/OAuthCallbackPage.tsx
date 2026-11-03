import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/context/AuthContext';
import { userApi } from '@/lib/userApi';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { BrandLockup } from '@/layout/BrandMark';

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('인증 중입니다...');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // URL에서 tempCode 또는 token을 가져와서 이미 처리된 것인지 확인
    const tempCode = searchParams.get('tempCode');
    const token = searchParams.get('token');
    const processingKey = `oauth_processing_${tempCode || token}`;
    
    // 이미 처리 중이거나 처리된 요청인지 확인
    if (isProcessing || sessionStorage.getItem(processingKey)) {
      console.log('OAuth 콜백 이미 처리 중 또는 처리 완료, 중복 실행 방지');
      return;
    }

    const handleOAuthCallback = async () => {
      setIsProcessing(true);
      
      // 처리 중임을 표시
      if (tempCode || token) {
        sessionStorage.setItem(processingKey, 'true');
      }
      
      // 회원가입인지 로그인인지 확인
      const isSignup = sessionStorage.getItem('isOAuthSignup') === 'true';
      sessionStorage.removeItem('isOAuthSignup');
      let postLoginPath = '/';
      
      try {
        setMessage(isSignup ? '회원가입을 완료하는 중입니다...' : '로그인 중입니다...');

        // URL 파라미터에서 토큰이나 에러 확인
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken');
        const error = searchParams.get('error');
        const tempCode = searchParams.get('tempCode'); // 백엔드에서 임시 코드 발급하는 경우

        if (error) {
          setStatus('error');
          const errorMessage = decodeURIComponent(error);
          setMessage(isSignup ? `회원가입 실패: ${errorMessage}` : `로그인 실패: ${errorMessage}`);
          setTimeout(() => {
            navigate(isSignup ? '/signup' : '/login', { replace: true });
          }, 3000);
          return;
        }

        if (token && refreshToken) {
          // 직접 토큰을 받은 경우
          // 사용자 정보도 함께 받았는지 확인
          const userDataParam = searchParams.get('user');
          let userData = null;
          
          if (userDataParam) {
            try {
              userData = JSON.parse(decodeURIComponent(userDataParam));
            } catch (e) {
              console.warn('사용자 데이터 파싱 실패:', e);
            }
          }
          
          if (userData) {
            await auth.setTokensAndUser(token, refreshToken, userData);
          } else {
            // 사용자 정보가 없으면 세션 정보로 가져오기
            const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8081';
            const response = await fetch(`${apiUrl}/api/auth/session`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              const sessionData = await response.json();
              if (sessionData.success && sessionData.data.user) {
                await auth.setTokensAndUser(token, refreshToken, sessionData.data.user);
              } else {
                throw new Error('사용자 정보를 가져올 수 없습니다.');
              }
            } else {
              throw new Error('세션 정보 조회에 실패했습니다.');
            }
          }
          
          // 임시 저장된 초대 코드 확인
          const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
          if (pendingInviteCode) {
            sessionStorage.removeItem('pendingInviteCode');
            // 초대 화면에서 사용자가 직접 참여를 확인합니다.
              postLoginPath = `/invite/${encodeURIComponent(pendingInviteCode)}`;
          }            setStatus('success');
            setMessage(isSignup ? '회원가입이 완료되었습니다. 메인 페이지로 이동합니다...' : '로그인되었습니다. 메인 페이지로 이동합니다...');
            setTimeout(() => {
              // OAuth 로그인 완료 후 리다이렉트 플래그 초기화
              sessionStorage.removeItem('hasRedirectedFromRoot');
              navigate(postLoginPath, { replace: true });
            }, 1500);
        } else if (tempCode) {
          // 임시 코드를 받은 경우 (백엔드에서 임시 코드 방식 사용하는 경우)
          setMessage('인증을 완료하는 중입니다...');
          
          // 임시 코드를 JWT 토큰으로 교환
          const response = await userApi.exchangeTempCode(tempCode);
          
          if (response.success && response.data) {
            await auth.setTokensAndUser(
              response.data.token,
              response.data.refreshToken,
              response.data.user
            );
            
            // 임시 저장된 초대 코드 확인
            const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
            if (pendingInviteCode) {
              sessionStorage.removeItem('pendingInviteCode');
              // 초대 화면에서 사용자가 직접 참여를 확인합니다.
              postLoginPath = `/invite/${encodeURIComponent(pendingInviteCode)}`;
            }

            setStatus('success');
            setMessage(isSignup ? '회원가입이 완료되었습니다. 잠시 후 이동합니다...' : '로그인되었습니다. 잠시 후 이동합니다...');
            
            // 워크스페이스 컨텍스트가 로드될 시간을 기다린 후 이동
            setTimeout(() => {
              console.log('OAuth 로그인 완료, 메인 페이지로 이동');
              // 처리 완료 후 플래그 정리
              if (tempCode || searchParams.get('token')) {
                const cleanupKey = `oauth_processing_${tempCode || searchParams.get('token')}`;
                sessionStorage.removeItem(cleanupKey);
              }
              // OAuth 로그인 완료 후 리다이렉트 플래그 초기화 (새로운 로그인이므로)
              sessionStorage.removeItem('hasRedirectedFromRoot');
              navigate(postLoginPath, { replace: true });
            }, 2000);
          } else {
            throw new Error(response.message || '토큰 교환에 실패했습니다.');
          }
        } else {
          setStatus('error');
          setMessage('인증 정보를 받지 못했습니다.');
          setTimeout(() => {
            navigate(isSignup ? '/signup' : '/login', { replace: true });
          }, 3000);
        }
      } catch (error: any) {
        console.error('OAuth 콜백 처리 중 오류:', error);
        setStatus('error');
        setMessage(error.message || '인증 처리 중 오류가 발생했습니다.');
        setTimeout(() => {
          navigate(isSignup ? '/signup' : '/login', { replace: true });
        }, 3000);
      } finally {
        setIsProcessing(false);
        // 에러 발생시에도 처리 플래그 정리
        const tempCode = searchParams.get('tempCode');
        const token = searchParams.get('token');
        if (tempCode || token) {
          const cleanupKey = `oauth_processing_${tempCode || token}`;
          setTimeout(() => {
            sessionStorage.removeItem(cleanupKey);
          }, 5000); // 5초 후 정리 (에러 상황 고려)
        }
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, auth]); // isProcessing 의존성 제거

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas px-4">
      <BrandLockup />
      <div
        role={status === 'error' ? 'alert' : 'status'}
        className="w-full max-w-sm rounded-modal border border-outline-soft bg-surface px-6 py-8 text-center"
      >
        {status === 'loading' && (
          <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" aria-hidden="true" />
        )}
        {status === 'success' && <CheckCircleIcon className="mx-auto h-12 w-12 text-success" aria-hidden="true" />}
        {status === 'error' && <ExclamationCircleIcon className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />}
        <p className={`mt-4 font-semibold ${status === 'error' ? 'text-danger' : 'text-ink'}`}>{message}</p>
        {status === 'error' && <p className="mt-2 text-sm text-muted">잠시 후 로그인 화면으로 이동해요.</p>}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
