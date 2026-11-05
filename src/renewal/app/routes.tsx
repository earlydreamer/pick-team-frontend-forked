import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/renewal/shell/AppShell';
import { NotFoundScreen, RootRedirect } from '@/renewal/screens/system';
import { GuestOnly, RequireAuth, RequireConsent } from '@/renewal/features/auth/guards';
import { LoadingState } from '@/renewal/ui';

/**
 * 화면 단위 코드 분할. 셸, 가드, 시스템 화면만 첫 번들에 두고 나머지 화면은 처음 열 때 내려받는다.
 * 화면 모듈은 이름 있는 내보내기를 쓰므로 lazy가 요구하는 default 형태로 감싼다.
 * 같은 파일의 화면들은 한 덩어리로 묶여 함께 내려받는다.
 */
const lazyNamed = <M extends Record<string, unknown>, K extends keyof M>(load: () => Promise<M>, name: K) =>
  lazy(() => load().then((module) => ({ default: module[name] as React.ComponentType })));

const auth = {
  login: () => import('@/renewal/features/auth/LoginScreen'),
  signup: () => import('@/renewal/features/auth/SignupScreen'),
  reset: () => import('@/renewal/features/auth/ResetPasswordScreen'),
  oauth: () => import('@/renewal/features/auth/OAuthCallbackScreen'),
  invite: () => import('@/renewal/features/auth/InviteScreen'),
  welcome: () => import('@/renewal/features/auth/WelcomeScreen'),
};
const policy = {
  agreements: () => import('@/renewal/features/policy/AgreementsScreen'),
  documents: () => import('@/renewal/features/policy/PolicyScreens'),
};
const teamSpace = {
  layout: () => import('@/renewal/features/teamSpace/TeamSpaceLayout'),
  board: () => import('@/renewal/features/teamSpace/BoardScreens'),
};

const LoginScreen = lazyNamed(auth.login, 'LoginScreen');
const SignupScreen = lazyNamed(auth.signup, 'SignupScreen');
const ResetPasswordScreen = lazyNamed(auth.reset, 'ResetPasswordScreen');
const OAuthCallbackScreen = lazyNamed(auth.oauth, 'OAuthCallbackScreen');
const InviteScreen = lazyNamed(auth.invite, 'InviteScreen');
const WelcomeScreen = lazyNamed(auth.welcome, 'WelcomeScreen');
const AgreementsScreen = lazyNamed(policy.agreements, 'AgreementsScreen');
const PrivacyScreen = lazyNamed(policy.documents, 'PrivacyScreen');
const TermsScreen = lazyNamed(policy.documents, 'TermsScreen');
const OnboardingScreen = lazyNamed(() => import('@/renewal/features/card/OnboardingScreen'), 'OnboardingScreen');
const CardEditScreen = lazyNamed(() => import('@/renewal/features/card/CardEditScreen'), 'CardEditScreen');
const GalleryScreen = lazyNamed(() => import('@/renewal/features/members/GalleryScreen'), 'GalleryScreen');
const MemberDetailScreen = lazyNamed(() => import('@/renewal/features/members/MemberDetailScreen'), 'MemberDetailScreen');
const HomeScreen = lazyNamed(() => import('@/renewal/features/home/HomeScreen'), 'HomeScreen');
const TeamBuildingHome = lazyNamed(() => import('@/renewal/features/teamBuilding/TeamBuildingHome'), 'TeamBuildingHome');
const TeamRecruitDetail = lazyNamed(() => import('@/renewal/features/teamBuilding/TeamRecruitDetail'), 'TeamRecruitDetail');
const InboxScreen = lazyNamed(() => import('@/renewal/features/teamBuilding/InboxScreen'), 'InboxScreen');
const ManageScreen = lazyNamed(() => import('@/renewal/features/manage/ManageScreen'), 'ManageScreen');
const DashboardScreen = lazyNamed(() => import('@/renewal/features/dashboard/DashboardScreen'), 'DashboardScreen');
const TeamSpaceLayout = lazyNamed(teamSpace.layout, 'TeamSpaceLayout');
// 팀 스페이스 탭 가드. 레이아웃과 같은 모듈이라 함께 내려받는다.
const TeamMemberOnly = lazyNamed(teamSpace.layout, 'TeamMemberOnly') as unknown as React.FC<{ children: React.ReactNode }>;
const OverviewScreen = lazyNamed(() => import('@/renewal/features/teamSpace/OverviewScreen'), 'OverviewScreen');
const KanbanScreen = lazyNamed(() => import('@/renewal/features/teamSpace/KanbanScreen'), 'KanbanScreen');
const CalendarScreen = lazyNamed(() => import('@/renewal/features/teamSpace/CalendarScreen'), 'CalendarScreen');
const BoardScreen = lazyNamed(teamSpace.board, 'BoardScreen');
const PostDetailScreen = lazyNamed(teamSpace.board, 'PostDetailScreen');
const AnnouncementsScreen = lazyNamed(teamSpace.board, 'AnnouncementsScreen');
const TeamSettingsScreen = lazyNamed(() => import('@/renewal/features/teamSpace/TeamSettingsScreen'), 'TeamSettingsScreen');
const ChatListScreen = lazyNamed(() => import('@/renewal/features/chat/ChatListScreen'), 'ChatListScreen');
const ChatRoomScreen = lazyNamed(() => import('@/renewal/features/chat/ChatRoomScreen'), 'ChatRoomScreen');
const VideoScreen = lazyNamed(() => import('@/renewal/features/chat/VideoScreen'), 'VideoScreen');
const NotificationsScreen = lazyNamed(() => import('@/renewal/features/notifications/NotificationsScreen'), 'NotificationsScreen');
const AccountSettingsScreen = lazyNamed(() => import('@/renewal/features/account/AccountSettingsScreen'), 'AccountSettingsScreen');
const MyPageScreen = lazyNamed(() => import('@/renewal/features/account/MyPageScreen'), 'MyPageScreen');
const WorkspaceAnnouncementsScreen = lazyNamed(() => import('@/renewal/features/announcements/WorkspaceAnnouncementsScreen'), 'WorkspaceAnnouncementsScreen');
const WorkspaceSettingsScreen = lazyNamed(() => import('@/renewal/features/workspaceSettings/WorkspaceSettingsScreen'), 'WorkspaceSettingsScreen');

/** 셸 밖 화면(인증, 정책, 온보딩)이 내려받는 동안 보이는 자리. 셸 안 화면은 AppShell이 따로 감싼다. */
const ScreenFallback: React.FC = () => <LoadingState className="min-h-screen" label="화면을 불러오는 중이에요" />;

/**
 * 리뉴얼 라우트. URL 체계는 docs/renewal/spec/02-information-architecture.md §4를 따른다.
 * 로그인한 화면은 약관 동의(RequireConsent)도 거친다.
 * 인증 화면과 초대 랜딩을 뺀 모든 화면은 RequireAuth 아래에 둔다.
 */
export const AppRoutes: React.FC = () => (
  <Suspense fallback={<ScreenFallback />}>
  <Routes>
    {/* 인증 화면(10 §4). 로그인한 사람은 원래 목적지로 보낸다. */}
    <Route element={<GuestOnly />}>
      <Route path="login" element={<LoginScreen />} />
      <Route path="signup" element={<SignupScreen />} />
      <Route path="reset-password" element={<ResetPasswordScreen />} />
    </Route>
    <Route path="oauth/callback" element={<OAuthCallbackScreen />} />
    {/* 초대 랜딩과 정책 문서는 로그인하지 않아도 열린다(10 §2, 17 §6.2). */}
    <Route path="invite/:code" element={<InviteScreen />} />
    <Route path="privacy" element={<PrivacyScreen />} />
    <Route path="terms" element={<TermsScreen />} />
    <Route element={<RequireAuth />}>
    <Route path="agreements" element={<AgreementsScreen />} />
    <Route element={<RequireConsent />}>
    {/* 온보딩 위저드는 셸 없이 단독 화면으로 띄운다(목업 onboarding.html). */}
    <Route path="ws/:wsId/onboarding" element={<OnboardingScreen />} />
    <Route element={<AppShell />}>
      <Route index element={<RootRedirect />} />
      <Route path="welcome" element={<WelcomeScreen />} />
      <Route path="notifications" element={<NotificationsScreen />} />
      <Route path="me" element={<MyPageScreen />} />
      <Route path="me/card" element={<CardEditScreen />} />
      <Route path="me/settings" element={<AccountSettingsScreen />} />
      <Route path="ws/:wsId">
        <Route index element={<HomeScreen />} />
        <Route path="members" element={<GalleryScreen />} />
        <Route path="announcements" element={<WorkspaceAnnouncementsScreen />} />
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
    </Route>
  </Routes>
  </Suspense>
);
