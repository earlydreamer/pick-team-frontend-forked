import React from 'react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { safeRedirect } from '@/renewal/domain/auth';
import { useMe } from '@/renewal/data/queries';
import { Button, ErrorState, LoadingState } from '@/renewal/ui';

/**
 * 로그인이 필요한 화면. 미인증이면 로그인으로 보내되 원래 목적지를 redirect 쿼리로 보존한다(10 §2).
 */
export const RequireAuth: React.FC = () => {
  const me = useMe();
  const location = useLocation();
  if (me.isLoading) return <LoadingState className="min-h-screen" label="로그인 상태를 확인하는 중이에요" />;
  if (me.isError) {
    return (
      <ErrorState
        className="min-h-screen"
        title="로그인 상태를 확인하지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => me.refetch()}>다시 시도</Button>}
      />
    );
  }
  if (!me.data) {
    const target = `${location.pathname}${location.search}`;
    return <Navigate to={target === '/' ? '/login' : `/login?redirect=${encodeURIComponent(target)}`} replace />;
  }
  return <Outlet />;
};

/** 로그인·가입·재설정 화면. 이미 로그인했으면 원래 목적지나 첫 화면으로 보낸다. */
export const GuestOnly: React.FC = () => {
  const me = useMe();
  const [params] = useSearchParams();
  if (me.isLoading) return <LoadingState className="min-h-screen" label="로그인 상태를 확인하는 중이에요" />;
  if (me.data) return <Navigate to={safeRedirect(params.get('redirect')) ?? '/'} replace />;
  return <Outlet />;
};
