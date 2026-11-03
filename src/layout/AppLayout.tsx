import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';
import { WorkspaceNav } from '@/features/workspace/core/components/WorkspaceNav';
import { WorkspaceRail } from './WorkspaceRail';
import { AccountMenu } from './AccountMenu';
import { BrandLockup } from './BrandMark';

/** 주소의 워크스페이스 ID를 현재 워크스페이스로 맞춥니다. 홈 외의 하위 경로로 바로 들어와도 일치합니다. */
const useSyncWorkspaceFromRoute = (workspaceId: string | undefined) => {
  const { workspaces, currentWorkspace, setCurrentWorkspaceById } = useWorkspace();
  useEffect(() => {
    if (!workspaceId || currentWorkspace?.id === workspaceId) return;
    if (workspaces.some((ws) => ws.id === workspaceId)) {
      setCurrentWorkspaceById(workspaceId);
      localStorage.setItem('lastAccessedWorkspaceId', workspaceId);
    }
  }, [workspaceId, workspaces, currentWorkspace, setCurrentWorkspaceById]);
};

/**
 * 앱 셸: 데스크톱은 워크스페이스 레일(72px) + 컨텍스트 탐색(248px) + 본문,
 * 모바일은 상단 막대와 열고 닫는 탐색 서랍을 사용합니다.
 */
export const AppLayout: React.FC = () => {
  const location = useLocation();
  const workspaceMatch = useMatch('/ws/:workspaceId/*');
  const workspaceId = workspaceMatch?.params.workspaceId;
  const { currentWorkspace } = useWorkspace();
  useSyncWorkspaceFromRoute(workspaceId);

  const showWorkspaceNav = Boolean(workspaceId && currentWorkspace);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // 이동하면 서랍을 닫습니다.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  // 서랍: Escape로 닫기, 열릴 때 서랍으로 포커스 이동, 닫힐 때 메뉴 버튼으로 복귀
  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]:not(#app-drawer)')) setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      menuButtonRef.current?.focus();
    };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only z-[200] rounded-lg bg-surface px-4 py-3 font-semibold text-primary shadow-float focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        본문으로 건너뛰기
      </a>

      {/* 모바일 상단 막대 */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-outline-soft bg-surface/95 px-2 backdrop-blur lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="탐색 열기"
          aria-expanded={drawerOpen}
          aria-controls="app-drawer"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface-container"
        >
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          {currentWorkspace && workspaceId ? (
            <p className="truncate text-base font-bold">{currentWorkspace.name}</p>
          ) : (
            <BrandLockup className="text-base" />
          )}
        </div>
        <AccountMenu placement="topbar" />
      </header>

      {/* 데스크톱 고정 탐색 */}
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:flex">
        <WorkspaceRail />
        {showWorkspaceNav && <WorkspaceNav />}
      </div>

      {/* 모바일 탐색 서랍 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/40" onClick={closeDrawer} aria-hidden="true" />
          <div
            id="app-drawer"
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="탐색"
            className="absolute inset-y-0 left-0 flex max-w-[calc(100%-48px)] bg-surface shadow-float focus:outline-none"
          >
            <WorkspaceRail onNavigate={closeDrawer} />
            {showWorkspaceNav && <WorkspaceNav onNavigate={closeDrawer} />}
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="탐색 닫기"
              className="absolute -right-12 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-float"
            >
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={`min-h-screen pt-14 focus:outline-none lg:pt-0 ${showWorkspaceNav ? 'lg:pl-[320px]' : 'lg:pl-[72px]'}`}
      >
        <Outlet />
      </main>
    </div>
  );
};
