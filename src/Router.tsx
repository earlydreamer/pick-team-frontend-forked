import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { ProtectedRoute } from '@/layout/ProtectedRoute';
import { Card, Button, Badge } from '@/components/ui';

// Route-level code splitting (vercel-react-best-practices: bundle-dynamic-imports)
const LandingPage = lazy(() =>
  import('@/features/renewal/routes/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const InviteLandingPage = lazy(() =>
  import('@/features/renewal/routes/InviteLandingPage').then((m) => ({ default: m.InviteLandingPage }))
);
const OnboardingWizardPage = lazy(() =>
  import('@/features/renewal/routes/OnboardingWizardPage').then((m) => ({
    default: m.OnboardingWizardPage,
  }))
);
const MemberCardGalleryPage = lazy(() =>
  import('@/features/renewal/routes/MemberCardGalleryPage').then((m) => ({
    default: m.MemberCardGalleryPage,
  }))
);
const InstructorDashboardPage = lazy(() =>
  import('@/features/renewal/routes/InstructorDashboardPage').then((m) => ({
    default: m.InstructorDashboardPage,
  }))
);
const WorkspaceSettingsPage = lazy(() =>
  import('@/features/renewal/routes/WorkspaceSettingsPage').then((m) => ({
    default: m.WorkspaceSettingsPage,
  }))
);
const AdminReportsPage = lazy(() =>
  import('@/features/renewal/routes/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage }))
);
const LoginPage = lazy(() =>
  import('@/features/user/auth/routes/AuthPage').then((m) => ({ default: m.LoginPage }))
);
const SignupPage = lazy(() =>
  import('@/features/user/auth/routes/AuthPage').then((m) => ({ default: m.SignupPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/user/auth/routes/AuthPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const OAuthCallbackPage = lazy(() =>
  import('@/features/user/auth/routes/OAuthCallbackPage').then((m) => ({
    default: m.OAuthCallbackPage,
  }))
);
const MyPage = lazy(() =>
  import('@/features/user/mypage/routes/MyPageStack').then((m) => ({ default: m.MyPage }))
);
const ProfileEditPage = lazy(() =>
  import('@/features/user/mypage/routes/MyPageStack').then((m) => ({ default: m.ProfileEditPage }))
);
const AccountSettingsPage = lazy(() =>
  import('@/features/user/mypage/routes/MyPageStack').then((m) => ({
    default: m.AccountSettingsPage,
  }))
);
const UserProfileViewPage = lazy(() =>
  import('@/features/user/mypage/routes/UserProfilePage').then((m) => ({
    default: m.UserProfileViewPage,
  }))
);
const TeamBuildingHomePage = lazy(() =>
  import('@/features/teamspace/team/routes/TeamFormationStack').then((m) => ({
    default: m.TeamBuildingHomePage,
  }))
);
const TeamRecruitmentDetailPage = lazy(() =>
  import('@/features/teamspace/team/routes/TeamFormationStack').then((m) => ({
    default: m.TeamRecruitmentDetailPage,
  }))
);
const TeamBuildingInboxPage = lazy(() =>
  import('@/features/teamspace/team/routes/TeamFormationStack').then((m) => ({
    default: m.TeamBuildingInboxPage,
  }))
);
const TeamBuildingManagePage = lazy(() =>
  import('@/features/teamspace/team/routes/TeamFormationStack').then((m) => ({
    default: m.TeamBuildingManagePage,
  }))
);
const TeamSpacePage = lazy(() =>
  import('@/features/teamspace/core/routes/TeamSpacePage').then((m) => ({ default: m.TeamSpacePage }))
);
const NotificationsPage = lazy(() =>
  import('@/features/user/notification/routes/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  }))
);
const HomePage = lazy(() =>
  import('@/features/workspace/core/routes/HomePage').then((m) => ({ default: m.HomePage }))
);
const ChatPage = lazy(() =>
  import('@/features/workspace/chat/routes/ChatPage').then((m) => ({ default: m.ChatPage }))
);
const VideoConferencePage = lazy(() =>
  import('@/features/workspace/video/routes/VideoConferencePage').then((m) => ({
    default: m.VideoConferencePage,
  }))
);
const EmptyWorkspacePage = lazy(() =>
  import('@/features/workspace/core/routes/EmptyWorkspacePage').then((m) => ({
    default: m.EmptyWorkspacePage,
  }))
);

const RouteFallback: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-6">
    <div className="flex items-center gap-3 text-xs font-bold text-ink-secondary">
      <div className="w-5 h-5 border-2 border-peri-600 border-t-transparent rounded-full animate-spin" />
      <span>화면을 불러오는 중...</span>
    </div>
  </div>
);

const NotFoundOrForbiddenPage: React.FC = () => (
  <div className="max-w-xl mx-auto px-4 py-16">
    <Card className="text-center py-10 space-y-4">
      <Badge variant="peri" size="xs">
        404 / 403 안내 (02 §4 · 02-D2)
      </Badge>
      <h1 className="text-xl font-extrabold text-ink-primary">
        요청하신 페이지를 찾을 수 없거나 접근 권한이 필요합니다
      </h1>
      <p className="text-xs sm:text-sm text-ink-secondary">
        워크스페이스 홈 또는 서비스 소개 랜딩 페이지로 이동할 수 있습니다.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <Link to="/landing">
          <Button variant="outline" size="sm">
            랜딩 페이지 보기
          </Button>
        </Link>
        <Link to="/ws/ws-kosta-295">
          <Button variant="primary" size="sm">
            워크스페이스 홈으로 이동 →
          </Button>
        </Link>
      </div>
    </Card>
  </div>
);

const Router: React.FC = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public / Marketing / Auth Routes (Spec 02 §3.1) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ForgotPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/invite/:code" element={<InviteLandingPage />} />
        <Route path="/oauth/success" element={<OAuthCallbackPage />} />

        {/* App Shell Protected Routes (Spec 02 §3.2 ~ §3.5) */}
        <Route element={<ProtectedRoute />}>
          {/* Unassigned Workspace Landing (SCR-WS-04) */}
          <Route path="/welcome" element={<EmptyWorkspacePage />} />
          <Route path="/empty-workspace" element={<EmptyWorkspacePage />} />

          {/* Workspace Routes */}
          <Route path="/ws/:workspaceId" element={<HomePage />} />
          <Route path="/ws/:workspaceId/onboarding" element={<OnboardingWizardPage />} />
          <Route path="/ws/:workspaceId/members" element={<MemberCardGalleryPage />} />
          <Route path="/ws/:workspaceId/members/:accountId" element={<UserProfileViewPage />} />
          <Route path="/ws/:workspaceId/dashboard" element={<InstructorDashboardPage />} />
          <Route path="/ws/:workspaceId/settings" element={<WorkspaceSettingsPage />} />

          {/* Team Building Routes (SCR-TB-01 ~ 04 + Legacy Hub compatibility M1.1) */}
          <Route path="/ws/:workspaceId/team-building" element={<TeamBuildingHomePage />} />
          <Route
            path="/ws/:workspaceId/team-building/teams/:teamId"
            element={<TeamRecruitmentDetailPage />}
          />
          <Route path="/ws/:workspaceId/team-building/inbox" element={<TeamBuildingInboxPage />} />
          <Route path="/ws/:workspaceId/team-building/manage" element={<TeamBuildingManagePage />} />
          <Route path="/ws/:workspaceId/team-formation" element={<TeamBuildingHomePage />} />
          <Route path="/ws/:workspaceId/team-formation/*" element={<TeamBuildingHomePage />} />

          {/* Team Space Routes (SCR-TM-01 ~ 06) */}
          <Route path="/ws/:workspaceId/team/:teamId" element={<TeamSpacePage />} />
          <Route
            path="/ws/:workspaceId/team/:teamId/kanban"
            element={<TeamSpacePage forcedTab="kanban" />}
          />
          <Route
            path="/ws/:workspaceId/team/:teamId/calendar"
            element={<TeamSpacePage forcedTab="calendar" />}
          />
          <Route
            path="/ws/:workspaceId/team/:teamId/board"
            element={<TeamSpacePage forcedTab="board" />}
          />
          <Route
            path="/ws/:workspaceId/team/:teamId/announcements"
            element={<TeamSpacePage forcedTab="announcements" />}
          />
          <Route
            path="/ws/:workspaceId/team/:teamId/settings"
            element={<TeamSpacePage forcedTab="settings" />}
          />

          {/* Communication Routes (SCR-CHAT-01, SCR-VID-01) */}
          <Route path="/ws/:workspaceId/chat/:chatId" element={<ChatPage />} />
          <Route path="/ws/:workspaceId/video/live" element={<VideoConferencePage />} />
          <Route path="/ws/:workspaceId/video/:channelId" element={<VideoConferencePage />} />

          {/* Global Overlay / Account Routes (SCR-NOTI-01, SCR-MY-01~03, SCR-SYS-01) */}
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/me" element={<MyPage />} />
          <Route path="/me/card" element={<ProfileEditPage />} />
          <Route path="/me/settings" element={<AccountSettingsPage />} />
          <Route path="/my-page" element={<Navigate to="/me" replace />} />
          <Route path="/my-page/profile-edit" element={<Navigate to="/me/card" replace />} />
          <Route path="/my-page/account-settings" element={<Navigate to="/me/settings" replace />} />
          <Route path="/users/:userId" element={<UserProfileViewPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />

          <Route path="*" element={<NotFoundOrForbiddenPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default Router;
