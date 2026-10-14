import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/context/AuthContext';
import { workspaceApi } from '@/features/workspace/management/api/workspaceApi';
import { userApi } from '@/lib/userApi';

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('소셜 인증을 처리하고 있습니다...');

  useEffect(() => {
    let mounted = true;

    const finalizeInviteAndRedirect = async () => {
      const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
      if (pendingInviteCode) {
        sessionStorage.removeItem('pendingInviteCode');
        try {
          const joinedWs = await workspaceApi.join({ inviteCode: pendingInviteCode });
          navigate(`/ws/${joinedWs.id}/onboarding`, { replace: true });
          return;
        } catch {
          navigate('/ws/ws-kosta-295/onboarding', { replace: true });
          return;
        }
      }
      sessionStorage.removeItem('hasRedirectedFromRoot');
      navigate('/ws/ws-kosta-295', { replace: true });
    };

    const run = async () => {
      const error = searchParams.get('error');
      const token = searchParams.get('token');
      const refreshToken = searchParams.get('refreshToken');
      const tempCode = searchParams.get('tempCode');

      if (error) {
        if (!mounted) return;
        setStatus('error');
        setMessage(decodeURIComponent(error));
        setTimeout(() => navigate('/login', { replace: true }), 2500);
        return;
      }

      try {
        if (token && refreshToken) {
          const userDataParam = searchParams.get('user');
          const parsedUser = userDataParam ? JSON.parse(decodeURIComponent(userDataParam)) : {
            id: '1',
            name: '박재현',
            email: 'jaehyun@pickteam.kr',
          };
          await auth.setTokensAndUser(token, refreshToken, parsedUser);
          if (!mounted) return;
          setStatus('success');
          setMessage('인증이 완료되었습니다. 워크스페이스로 이동합니다...');
          setTimeout(finalizeInviteAndRedirect, 900);
          return;
        }

        if (tempCode) {
          const response = await userApi.exchangeTempCode(tempCode);
          if (response.success && response.data) {
            await auth.setTokensAndUser(
              response.data.token,
              response.data.refreshToken,
              response.data.user
            );
            if (!mounted) return;
            setStatus('success');
            setMessage('인증이 완료되었습니다. 워크스페이스로 이동합니다...');
            setTimeout(finalizeInviteAndRedirect, 900);
            return;
          }
        }

        // Fallback if opened directly
        await finalizeInviteAndRedirect();
      } catch (err: any) {
        if (!mounted) return;
        setStatus('error');
        setMessage(err?.message || '소셜 로그인 처리 중 오류가 발생했습니다.');
        setTimeout(() => navigate('/login', { replace: true }), 2500);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [auth, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-craft-md border border-neutral-200 p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-peri-500 text-white font-black text-lg flex items-center justify-center mx-auto">
          PT
        </div>
        <h1 className="text-lg font-extrabold text-ink-primary">Pick Team 소셜 인증</h1>
        <p className="text-sm text-ink-secondary">{message}</p>
        {status === 'loading' && (
          <div className="w-6 h-6 border-2 border-peri-600 border-t-transparent rounded-full animate-spin mx-auto" />
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
