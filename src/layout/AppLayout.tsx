import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { useRenewal, ActivePersonaPreset } from '@/features/renewal/context/RenewalContext';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { Modal, Button, Input } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/core/hooks/useWorkspace';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentUser, logout } = useAuth();
  const {
    activePersona,
    switchPersona,
    getWorkspaceById,
    getEffectiveWorkspaceRole,
    getTeamKanbanTasks,
    unreadNotificationCount,
    isSystemAdmin,
  } = useRenewal();
  const { createWorkspace } = useWorkspace();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [wsModalOpen, setWsModalOpen] = useState(false);
  const [wsModalTab, setWsModalTab] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newWsName, setNewWsName] = useState('');

  const activeWs = getWorkspaceById(workspaceId);
  const effectiveWsId = activeWs.id;
  const role = getEffectiveWorkspaceRole(effectiveWsId);
  const isManagerOrOwner = role === 'OWNER' || role === 'ADMIN';

  const tasks = getTeamKanbanTasks('team-alpha');
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  const isNavActive = (key: 'home' | 'kanban' | 'team' | 'pr' | 'calendar' | 'settings' | 'dashboard') => {
    const p = location.pathname;
    if (key === 'home') return p === `/ws/${effectiveWsId}`;
    if (key === 'kanban') return p.includes('/kanban');
    if (key === 'team') return p.includes('/team-building') || p.includes('/team-formation');
    if (key === 'pr') return p.includes('/members') || p.startsWith('/me');
    if (key === 'calendar') return p.includes('/calendar');
    if (key === 'settings') return p.endsWith('/settings');
    if (key === 'dashboard') return p.includes('/dashboard');
    return false;
  };

  const navItems = [
    {
      key: 'home' as const,
      label: '홈',
      path: `/ws/${effectiveWsId}`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      key: 'kanban' as const,
      label: '칸반 보드',
      path: `/ws/${effectiveWsId}/team/team-alpha/kanban`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      ),
    },
    {
      key: 'team' as const,
      label: '팀원',
      path: `/ws/${effectiveWsId}/team-building`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      key: 'pr' as const,
      label: 'PR 카드',
      path: `/ws/${effectiveWsId}/members`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
          />
        </svg>
      ),
    },
    {
      key: 'calendar' as const,
      label: '일정',
      path: `/ws/${effectiveWsId}/team/team-alpha/calendar`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      key: 'settings' as const,
      label: '설정',
      path: `/ws/${effectiveWsId}/settings`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const handleWsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wsModalTab === 'JOIN') {
      if (!inviteCodeInput.trim()) return;
      setWsModalOpen(false);
      navigate(`/invite/${encodeURIComponent(inviteCodeInput.trim())}`);
    } else {
      if (!newWsName.trim()) return;
      try {
        const created = await createWorkspace({ name: newWsName.trim() });
        setWsModalOpen(false);
        navigate(`/ws/${created.id}`);
      } catch {
        setWsModalOpen(false);
        navigate(`/ws/ws-kosta-295`);
      }
    }
  };

  const renderSidebar = (onCloseMobile?: () => void) => (
    <aside
      aria-label="주 네비게이션 사이드바"
      className="w-[248px] h-full bg-[#191B32] text-white flex flex-col justify-between shrink-0 select-none"
    >
      {/* Top Logo & Nav Links (Matches 02. 워크스페이스 대시보드 Left Sidebar) */}
      <div>
        <div className="h-[68px] px-6 flex items-center justify-between border-b border-white/[0.06]">
          <Link
            to="/landing"
            onClick={onCloseMobile}
            className="flex items-center gap-3 group"
          >
            <div className="w-8 h-8 rounded-xl bg-peri-500 flex items-center justify-center text-white font-extrabold text-sm shadow-peri-glow">
              PT
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">PickTeam</span>
          </Link>
        </div>

        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const active = isNavActive(item.key);
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={onCloseMobile}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] transition-all ${
                  active
                    ? 'bg-[#2C2F56] text-white font-bold shadow-xs'
                    : 'text-[#A0A5C4] font-medium hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span className={active ? 'text-[#818CF8]' : 'text-[#8B90B2]'}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isManagerOrOwner && (
            <Link
              to={`/ws/${effectiveWsId}/dashboard`}
              onClick={onCloseMobile}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-[14px] font-bold transition-colors mt-3 border border-peri-400/30 ${
                isNavActive('dashboard')
                  ? 'bg-peri-500 text-white'
                  : 'text-peri-300 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span>강사 운영 대시보드</span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/15 text-white">
                {role}
              </span>
            </Link>
          )}
        </nav>
      </div>

      {/* Bottom Sprint Widget + Profile Bar (Matches 02. 워크스페이스 대시보드 Left Sidebar Bottom) */}
      <div className="p-4 space-y-4">
        <div
          onClick={() => {
            onCloseMobile?.();
            navigate(`/ws/${effectiveWsId}/team/team-alpha/kanban`);
          }}
          className="p-4 rounded-2xl bg-[#232645] hover:bg-[#292D50] transition-colors cursor-pointer space-y-3 border border-white/[0.06]"
        >
          <div className="text-xs font-semibold text-[#9BA0C2]">현재 스프린트</div>
          <div className="flex items-baseline justify-between">
            <span className="text-base font-extrabold text-white">Sprint 01</span>
            <span className="text-sm font-bold text-[#A5B4FC] tabular-nums">D-3</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="flex justify-between text-xs text-[#9BA0C2] tabular-nums font-medium">
              <span>진행률</span>
              <span className="text-white font-bold">
                {doneCount + 5}/12
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-peri-400 to-secondary rounded-full"
                style={{ width: '62%' }}
              />
            </div>
          </div>
        </div>

        {/* User Footer with Role Switcher Popover (Matches 13. 캐릭터 및 아바타 '박' badge) */}
        <div className="relative pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className="w-full px-2 py-2 rounded-xl hover:bg-white/[0.05] flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-peri-500 text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-xs">
                {(currentUser?.name || '박재현').charAt(0)}
              </div>
              <div className="text-left min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {currentUser?.name?.split(' ')[0] || '박재현'}
                </div>
                <div className="text-xs font-medium text-[#9BA0C2]">
                  {activePersona === 'STUDENT'
                    ? 'Member'
                    : activePersona === 'LEADER'
                    ? 'Team Leader'
                    : activePersona === 'INSTRUCTOR'
                    ? 'Instructor'
                    : 'System Admin'}
                </div>
              </div>
            </div>
            <svg className="w-4 h-4 text-[#9BA0C2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {profileMenuOpen && (
            <div className="absolute bottom-16 left-0 w-full bg-[#242748] border border-white/15 rounded-2xl shadow-2xl p-2.5 space-y-1 z-50 text-xs">
              <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#9BA0C2]">
                시점 전환 (역할별 화면 확인)
              </div>
              {(
                [
                  { id: 'STUDENT', label: '박재현 · Member (수강생)' },
                  { id: 'LEADER', label: '이승우 · Leader (팀장)' },
                  { id: 'INSTRUCTOR', label: '박강사 · Instructor (강사)' },
                  { id: 'SYSADMIN', label: '운영자 · System Admin' },
                ] as { id: ActivePersonaPreset; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    switchPersona(p.id);
                    setProfileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl cursor-pointer font-semibold ${
                    activePersona === p.id
                      ? 'bg-peri-500 text-white'
                      : 'text-peri-100 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              <div className="border-t border-white/10 my-1.5 pt-1.5 space-y-1">
                <Link
                  to="/me"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onCloseMobile?.();
                  }}
                  className="block px-3 py-2 rounded-xl font-semibold text-peri-100 hover:bg-white/10"
                >
                  마이페이지 · 내 PR 카드
                </Link>
                {isSystemAdmin && (
                  <Link
                    to="/admin/reports"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onCloseMobile?.();
                    }}
                    className="block px-3 py-2 rounded-xl font-semibold text-peri-200 hover:bg-white/10"
                  >
                    신고 처리 콘솔
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setProfileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl font-semibold text-[#FCA5A5] hover:bg-white/10 cursor-pointer"
                >
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      {/* Desktop Single Left Sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0">
        {renderSidebar()}
      </div>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-[2px]"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 h-full shadow-2xl">
            {renderSidebar(() => setMobileDrawerOpen(false))}
          </div>
        </div>
      )}

      {/* Right Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalHeader
          onToggleMobileNav={() => setMobileDrawerOpen((prev) => !prev)}
          onOpenWorkspaceModal={() => setWsModalOpen(true)}
        />

        <main className="flex-1 pb-20 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom 5-Tab Bar (03. 모바일 대시보드 하단: 홈 / 칸반 / 팀원 / 알림 / 더보기) */}
      <nav
        aria-label="모바일 하단 네비게이션"
        className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E2E8F0] z-40 grid grid-cols-5 px-2"
      >
        <Link
          to={`/ws/${effectiveWsId}`}
          className={`flex flex-col items-center justify-center gap-1 text-xs ${
            isNavActive('home') ? 'text-peri-600 font-bold' : 'text-[#64748B] font-medium'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span>홈</span>
        </Link>

        <Link
          to={`/ws/${effectiveWsId}/team/team-alpha/kanban`}
          className={`flex flex-col items-center justify-center gap-1 text-xs ${
            isNavActive('kanban') ? 'text-peri-600 font-bold' : 'text-[#64748B] font-medium'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
            />
          </svg>
          <span>칸반</span>
        </Link>

        <Link
          to={`/ws/${effectiveWsId}/members`}
          className={`flex flex-col items-center justify-center gap-1 text-xs ${
            isNavActive('pr') || isNavActive('team')
              ? 'text-peri-600 font-bold'
              : 'text-[#64748B] font-medium'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>팀원</span>
        </Link>

        <Link
          to="/notifications"
          className={`flex flex-col items-center justify-center gap-1 text-xs relative ${
            location.pathname === '/notifications'
              ? 'text-peri-600 font-bold'
              : 'text-[#64748B] font-medium'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span>알림</span>
          {unreadNotificationCount > 0 && (
            <span className="absolute top-2.5 right-6 w-2 h-2 rounded-full bg-peri-600" />
          )}
        </Link>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-[#64748B] cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h.01M12 12h.01M19 12h.01" />
          </svg>
          <span>더보기</span>
        </button>
      </nav>

      {/* Workspace Join/Create Modal */}
      <Modal
        isOpen={wsModalOpen}
        onClose={() => setWsModalOpen(false)}
        title="워크스페이스 합류 및 개설"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F1F5F9] rounded-xl">
            <button
              type="button"
              onClick={() => setWsModalTab('JOIN')}
              className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                wsModalTab === 'JOIN' ? 'bg-white text-[#0F172A] shadow-2xs' : 'text-[#64748B]'
              }`}
            >
              초대 코드로 참여
            </button>
            <button
              type="button"
              onClick={() => setWsModalTab('CREATE')}
              className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                wsModalTab === 'CREATE' ? 'bg-white text-[#0F172A] shadow-2xs' : 'text-[#64748B]'
              }`}
            >
              새 워크스페이스 개설
            </button>
          </div>

          <form onSubmit={handleWsSubmit} className="space-y-4">
            {wsModalTab === 'JOIN' ? (
              <Input
                label="초대 코드"
                name="inviteCode"
                placeholder="예: KOSTA-295-PERI"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
              />
            ) : (
              <Input
                label="워크스페이스 이름"
                name="wsName"
                placeholder="예: 데브코스 클라우드 BE 5기"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setWsModalOpen(false)}>
                취소
              </Button>
              <Button type="submit" variant="primary" size="sm">
                확인
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
