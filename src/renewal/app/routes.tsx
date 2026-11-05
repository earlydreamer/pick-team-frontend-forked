import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/renewal/shell/AppShell';
import { NotFoundScreen, PendingScreen, RootRedirect } from '@/renewal/screens/system';
import { WelcomeScreen } from '@/renewal/features/auth/WelcomeScreen';
import { OnboardingScreen } from '@/renewal/features/card/OnboardingScreen';
import { CardEditScreen } from '@/renewal/features/card/CardEditScreen';
import { GalleryScreen } from '@/renewal/features/members/GalleryScreen';
import { MemberDetailScreen } from '@/renewal/features/members/MemberDetailScreen';
import { HomeScreen } from '@/renewal/features/home/HomeScreen';
import { TeamBuildingHome } from '@/renewal/features/teamBuilding/TeamBuildingHome';
import { TeamRecruitDetail } from '@/renewal/features/teamBuilding/TeamRecruitDetail';
import { InboxScreen } from '@/renewal/features/teamBuilding/InboxScreen';
import { ManageScreen } from '@/renewal/features/manage/ManageScreen';
import { DashboardScreen } from '@/renewal/features/dashboard/DashboardScreen';
import { GuestOnly, RequireAuth } from '@/renewal/features/auth/guards';
import { LoginScreen } from '@/renewal/features/auth/LoginScreen';
import { SignupScreen } from '@/renewal/features/auth/SignupScreen';
import { ResetPasswordScreen } from '@/renewal/features/auth/ResetPasswordScreen';
import { OAuthCallbackScreen } from '@/renewal/features/auth/OAuthCallbackScreen';
import { InviteScreen } from '@/renewal/features/auth/InviteScreen';
import { TeamMemberOnly, TeamSpaceLayout } from '@/renewal/features/teamSpace/TeamSpaceLayout';
import { OverviewScreen } from '@/renewal/features/teamSpace/OverviewScreen';
import { KanbanScreen } from '@/renewal/features/teamSpace/KanbanScreen';
import { CalendarScreen } from '@/renewal/features/teamSpace/CalendarScreen';
import { AnnouncementsScreen, BoardScreen, PostDetailScreen } from '@/renewal/features/teamSpace/BoardScreens';
import { TeamSettingsScreen } from '@/renewal/features/teamSpace/TeamSettingsScreen';
import { ChatListScreen } from '@/renewal/features/chat/ChatListScreen';
import { ChatRoomScreen } from '@/renewal/features/chat/ChatRoomScreen';
import { VideoScreen } from '@/renewal/features/chat/VideoScreen';
import { NotificationsScreen } from '@/renewal/features/notifications/NotificationsScreen';
import { AccountSettingsScreen } from '@/renewal/features/account/AccountSettingsScreen';
import { MyPageScreen } from '@/renewal/features/account/MyPageScreen';
import { WorkspaceSettingsScreen } from '@/renewal/features/workspaceSettings/WorkspaceSettingsScreen';

/**
 * 리뉴얼 라우트. URL 체계는 docs/renewal/spec/02-information-architecture.md §4를 따른다.
 * 목업 6종은 단계별 PR에서 PendingScreen을 실제 화면으로 바꾼다.
 * 인증 화면과 초대 랜딩을 뺀 모든 화면은 RequireAuth 아래에 둔다.
 */
export const AppRoutes: React.FC = () => (
  <Routes>
    {/* 인증 화면(10 §4). 로그인한 사람은 원래 목적지로 보낸다. */}
    <Route element={<GuestOnly />}>
      <Route path="login" element={<LoginScreen />} />
      <Route path="signup" element={<SignupScreen />} />
      <Route path="reset-password" element={<ResetPasswordScreen />} />
    </Route>
    <Route path="oauth/callback" element={<OAuthCallbackScreen />} />
    {/* 초대 랜딩은 로그인하지 않아도 열린다(10 §2). */}
    <Route path="invite/:code" element={<InviteScreen />} />
    <Route element={<RequireAuth />}>
    {/* 온보딩 위저드는 셸 없이 단독 화면으로 띄운다(목업 onboarding.html). */}
    <Route path="ws/:wsId/onboarding" element={<OnboardingScreen />} />
    <Route element={<AppShell />}>
      <Route index element={<RootRedirect />} />
      <Route path="welcome" element={<WelcomeScreen />} />
      <Route path="notifications" element={<NotificationsScreen />} />
      <Route path="me" element={<MyPageScreen />} />
      <Route path="me/card" element={<CardEditScreen />} />
      <Route path="privacy" element={<PendingScreen screenId="17-policy-operations.md" title="개인정보 처리방침" />} />
      <Route path="me/settings" element={<AccountSettingsScreen />} />
      <Route path="ws/:wsId">
        <Route index element={<HomeScreen />} />
        <Route path="members" element={<GalleryScreen />} />
        <Route path="members/:accountId" element={<MemberDetailScreen />} />
        <Route path="team-building" element={<TeamBuildingHome />} />
        <Route path="team-building/teams/:teamId" element={<TeamRecruitDetail />} />
        <Route path="team-building/inbox" element={<InboxScreen />} />
        <Route path="team-building/manage" element={<ManageScreen />} />
        <Route path="dashboard" element={<DashboardScreen />} />
        <Route path="settings" element={<WorkspaceSettingsScreen />} />
        <Route path="chat" element={<ChatListScreen />} />
        <Route path="chat/:roomId" element={<ChatRoomScreen />} />
        <Route path="video/:channelId" element={<VideoScreen />} />
        <Route path="team/:teamId" element={<TeamSpaceLayout />}>
          <Route index element={<OverviewScreen />} />
          <Route path="kanban" element={<KanbanScreen />} />
          <Route path="calendar" element={<TeamMemberOnly><CalendarScreen /></TeamMemberOnly>} />
          <Route path="board" element={<TeamMemberOnly><BoardScreen /></TeamMemberOnly>} />
          <Route path="board/:postId" element={<TeamMemberOnly><PostDetailScreen /></TeamMemberOnly>} />
          <Route path="announcements" element={<TeamMemberOnly><AnnouncementsScreen /></TeamMemberOnly>} />
          <Route path="settings" element={<TeamSettingsScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
      <Route path="*" element={<NotFoundScreen />} />
    </Route>
    </Route>
  </Routes>
);
