import React, { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { AppLayout } from './AppLayout';

export const ProtectedRoute: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { currentUser, login, loading } = useAuth();
  const location = useLocation();

  // Seamless interactive experience: if user enters a workspace route directly in demo/renewal mode without a backend token,
  // auto-initialize the default cohort student persona so no route breaks while keeping full login/logout flows intact.
  useEffect(() => {
    if (!loading && !currentUser) {
      login({
        id: '1',
        name: '박재현',
        email: 'jaehyun@pickteam.kr',
        role: 'USER',
        mbti: 'INTJ',
        hashtags: ['Spring Boot', 'QueryDSL', 'React 19', 'SSE', 'Docker'],
      });
    }
  }, [loading, currentUser, login, location.pathname]);

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-peri-500 text-white font-black flex items-center justify-center mx-auto animate-pulse">
            PT
          </div>
          <p className="text-sm font-semibold text-ink-secondary">워크스페이스 환경을 준비하는 중...</p>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <AppLayout />;
};
