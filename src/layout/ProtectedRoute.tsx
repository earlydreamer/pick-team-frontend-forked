import React, { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/user/auth/hooks/useAuth";
import { LoadingState } from "@/components/ui";
import { AppLayout } from "./AppLayout";

/** 로그인이 필요한 화면. 로그인 후 원래 경로(검색어 포함)로 돌아오도록 위치를 넘깁니다. */
export const ProtectedRoute: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="로그인 상태를 확인하는 중이에요" className="min-h-screen" />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: { pathname: location.pathname, search: location.search } }} replace />;
  }

  return children ? <>{children}</> : <AppLayout />;
};
