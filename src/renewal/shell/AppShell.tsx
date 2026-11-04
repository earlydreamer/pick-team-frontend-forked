import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useMatch } from 'react-router-dom';
import { Bars3Icon, BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { data } from '@/renewal/data';
import { useMyWorkspaces } from '@/renewal/data/queries';
import { BrandLockup } from './BrandMark';
import { WorkspaceRail } from './WorkspaceRail';
import { ContextNav } from './ContextNav';
import { AccountMenu } from './AccountMenu';

/**
 * 전역 레이아웃(02 §2.1, §2.2).
 * 1024px 이상은 WS 레일과 컨텍스트 내비를 고정한다. 768~1023px은 레일만 고정하고 내비는 드로어로 연다.
 * 768px 미만은 드로어 안에 레일과 내비를 함께 넣는다.
 */
export const AppShell: React.FC = () => {
  const location = useLocation();
  const inWorkspace = useMatch('/ws/:wsId/*') !== null;
  const { data: workspaces } = useMyWorkspaces();
  const homePath = workspaces?.[0] ? `/ws/${workspaces[0].id}` : '/';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const menuButton = menuButtonRef.current;
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      menuButton?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only z-[200] rounded-lg bg-surface px-4 py-3 font-semibold text-primary shadow-float focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        본문으로 건너뛰기
      </a>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-outline-soft bg-surface px-2 sm:px-4">
        {inWorkspace && (
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={drawerOpen}
            aria-controls="nav-drawer"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-container lg:hidden"
          >
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        <Link to={homePath} className="rounded-lg px-1" aria-label="Pick Team 워크스페이스 홈">
          <BrandLockup className="text-base" />
        </Link>
        {data.kind === 'mock' && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-warning ring-1 ring-inset ring-amber-200" title="실제 서버가 아니라 브라우저에 저장된 시연용 데이터로 동작해요">
            목업 데이터
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Link to="/notifications" aria-label="알림" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-container hover:text-ink">
            <BellIcon className="h-6 w-6" aria-hidden="true" />
          </Link>
          <AccountMenu />
        </div>
      </header>

      <div className="fixed bottom-0 left-0 top-14 z-30 hidden md:flex">
        <WorkspaceRail />
        <div className="hidden lg:flex">{inWorkspace && <ContextNav />}</div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div
            id="nav-drawer"
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="메뉴"
            className="absolute inset-y-0 left-0 flex max-w-[calc(100%-56px)] bg-surface shadow-float focus:outline-none"
          >
            <div className="md:hidden">
              <WorkspaceRail onNavigate={() => setDrawerOpen(false)} />
            </div>
            <ContextNav onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="메뉴 닫기"
              className="absolute -right-12 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-float"
            >
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <main id="main" tabIndex={-1} className={`min-h-screen pt-14 focus:outline-none md:pl-16 ${inWorkspace ? 'lg:pl-[304px]' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};
