import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Button, ErrorState, LoadingState } from '@/components/ui';
import { ProtectedRoute } from '@/layout/ProtectedRoute';
import { LoginPage, SignupPage, ForgotPasswordPage } from '@/features/user/auth/routes/AuthPage';
import { OAuthCallbackPage } from '@/features/user/auth/routes/OAuthCallbackPage';
import { MyPage, ProfileEditPage, AccountSettingsPage } from '@/features/user/mypage/routes/MyPageStack';
import { UserProfileViewPage } from '@/features/user/mypage/routes/UserProfilePage'; 
import { TeamFormationHubPage } from '@/features/teamspace/team/routes/TeamFormationStack'; 
import { TeamSpacePage } from '@/features/teamspace/core/routes/TeamSpacePage';
import { NotificationsPage } from '@/features/user/notification/routes/NotificationsPage'; 
import { HomePage } from '@/features/workspace/core/routes/HomePage';
import { ChatPage } from '@/features/workspace/chat/routes/ChatPage';
import { VideoConferencePage } from '@/features/workspace/video/routes/VideoConferencePage';
import EmptyWorkspacePage from '@/features/workspace/core/routes/EmptyWorkspacePage';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { useAuth } from '@/features/user/auth/hooks/useAuth';

const Router: React.FC = () => {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/oauth/success" element={<OAuthCallbackPage />} />

            <Route path="/" element={<ProtectedRoute />}>
                <Route index element={<NavigateToInitialView />} />
                <Route path="ws/:workspaceId" element={<HomePage />} />
                <Route path="ws/:workspaceId/team/:teamId" element={<TeamSpacePage />} />
                <Route path="ws/:workspaceId/chat/:chatId" element={<ChatPage />} />
                <Route path="ws/:workspaceId/video/live" element={<VideoConferencePage />} />
                <Route path="ws/:workspaceId/team-formation" element={<TeamFormationHubPage />} />

                <Route path="my-page" element={<MyPage />} />
                <Route path="my-page/profile-edit" element={<ProfileEditPage />} />
                <Route path="my-page/account-settings" element={<AccountSettingsPage />} />
                
                <Route path="users/:userId" element={<UserProfileViewPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="empty-workspace" element={<EmptyWorkspacePage />} />
            </Route>
        </Routes>
    );
};

/** 첫 진입: 마지막으로 방문한 워크스페이스(없으면 첫 워크스페이스)로, 소속이 없으면 합류 화면으로 보냅니다. */
const NavigateToInitialView: React.FC = () => {
  const { workspaces, loading, error, loadWorkspaces } = useWorkspace();
  const { currentUser } = useAuth();

  if (!currentUser || loading) {
    return <LoadingState label="워크스페이스를 불러오는 중이에요" className="min-h-[60vh]" />;
  }

  if (error && workspaces.length === 0) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="워크스페이스를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => loadWorkspaces()}>다시 시도</Button>}
      />
    );
  }

  if (workspaces.length === 0) {
    return <Navigate to="/empty-workspace" replace />;
  }

  const lastWorkspaceId = localStorage.getItem('lastAccessedWorkspaceId');
  const target = workspaces.find((ws) => String(ws.id) === lastWorkspaceId) || workspaces[0];
  return <Navigate to={`/ws/${target.id}`} replace />;
};

export default Router; 