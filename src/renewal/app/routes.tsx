import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/renewal/shell/AppShell';
import { NotFoundScreen, PendingScreen, RootRedirect, WelcomeScreen } from '@/renewal/screens/system';
import { OnboardingScreen } from '@/renewal/features/card/OnboardingScreen';
import { CardEditScreen } from '@/renewal/features/card/CardEditScreen';

/**
 * 리뉴얼 라우트. URL 체계는 docs/renewal/spec/02-information-architecture.md §4를 따른다.
 * 목업 6종은 단계별 PR에서 PendingScreen을 실제 화면으로 바꾼다.
 */
export const AppRoutes: React.FC = () => (
  <Routes>
    {/* 온보딩 위저드는 셸 없이 단독 화면으로 띄운다(목업 onboarding.html). */}
    <Route path="ws/:wsId/onboarding" element={<OnboardingScreen />} />
    <Route element={<AppShell />}>
      <Route index element={<RootRedirect />} />
      <Route path="welcome" element={<WelcomeScreen />} />
      <Route path="notifications" element={<PendingScreen screenId="SCR-NOTI-01" title="알림 센터" />} />
      <Route path="me" element={<PendingScreen screenId="SCR-MY-01" title="마이페이지" />} />
      <Route path="me/card" element={<CardEditScreen />} />
      <Route path="privacy" element={<PendingScreen screenId="17-policy-operations.md" title="개인정보 처리방침" />} />
      <Route path="me/settings" element={<PendingScreen screenId="SCR-MY-03" title="계정 설정" />} />
      <Route path="ws/:wsId">
        <Route index element={<PendingScreen screenId="SCR-WS-01" title="워크스페이스 홈" />} />
        <Route path="members" element={<PendingScreen screenId="SCR-WS-02" title="멤버 카드" />} />
        <Route path="members/:accountId" element={<PendingScreen screenId="SCR-PRF-01" title="카드 상세" />} />
        <Route path="team-building" element={<PendingScreen screenId="SCR-TB-01" title="팀 빌딩" />} />
        <Route path="team-building/manage" element={<PendingScreen screenId="SCR-TB-04" title="세션 운영" />} />
        <Route path="dashboard" element={<PendingScreen screenId="SCR-DSH-01" title="강사 대시보드" />} />
        <Route path="settings" element={<PendingScreen screenId="SCR-WS-03" title="워크스페이스 설정" />} />
        <Route path="team/:teamId/*" element={<PendingScreen screenId="SCR-TM-01" title="팀 개요" />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
      <Route path="*" element={<NotFoundScreen />} />
    </Route>
  </Routes>
);
