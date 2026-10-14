import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import { MemberAvatar } from '@/features/renewal/components/PeriwinkleArtwork';

interface GlobalHeaderProps {
  onToggleMobileNav?: () => void;
  onOpenWorkspaceModal?: () => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  onToggleMobileNav,
  onOpenWorkspaceModal,
}) => {
  const { currentUser } = useAuth();
  const {
    allWorkspaces,
    getWorkspaceById,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useRenewal();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const wsRef = useRef<HTMLDivElement>(null);
  const notiRef = useRef<HTMLDivElement>(null);

  const activeWs = getWorkspaceById(workspaceId);
  const effectiveWsId = activeWs.id;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false);
      }
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/ws/${effectiveWsId}/members?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="h-[68px] bg-white border-b border-[#E2E8F0] px-5 sm:px-8 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30">
      {/* Mobile Left: PickTeam Logo (03. 모바일 대시보드) */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link to={`/ws/${effectiveWsId}`} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-peri-500 text-white font-extrabold text-sm flex items-center justify-center shadow-peri-glow">
            PT
          </div>
          <span className="text-lg font-extrabold text-ink-primary tracking-tight">PickTeam</span>
        </Link>
      </div>

      {/* Desktop Left: Workspace Selector Box (02. 워크스페이스 대시보드 상단 좌측) */}
      <div className="hidden lg:block relative" ref={wsRef}>
        <button
          type="button"
          onClick={() => setWsDropdownOpen((prev) => !prev)}
          className="h-10 px-4 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] flex items-center gap-3 text-[15px] font-bold text-[#0F172A] shadow-2xs transition-colors cursor-pointer"
        >
          <span>{activeWs.name}</span>
          <svg className="w-4 h-4 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {wsDropdownOpen && (
          <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-craft-lg border border-[#E2E8F0] py-2 z-50">
            <div className="px-4 py-1.5 text-xs font-bold text-[#64748B]">
              워크스페이스 전환
            </div>
            {allWorkspaces.map((ws) => {
              const isCurrent = String(ws.id) === String(effectiveWsId);
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setWsDropdownOpen(false);
                    navigate(`/ws/${ws.id}`);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between cursor-pointer ${
                    isCurrent
                      ? 'bg-peri-50 text-peri-600 font-bold'
                      : 'text-[#0F172A] font-medium hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {isCurrent && <span className="text-peri-600 font-extrabold">✓</span>}
                </button>
              );
            })}
            <div className="border-t border-[#E2E8F0] mt-1.5 pt-1.5 px-2">
              <button
                type="button"
                onClick={() => {
                  setWsDropdownOpen(false);
                  onOpenWorkspaceModal?.();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-sm font-bold text-peri-600 hover:bg-peri-50 cursor-pointer"
              >
                + 새 워크스페이스 합류 · 개설
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Right: Search Pill + Utility Icons + Count Badge + Avatar (02. 워크스페이스 대시보드 상단 우측) */}
      <div className="hidden lg:flex items-center gap-3.5">
        <form onSubmit={handleSearchSubmit} className="relative w-72 xl:w-88">
          <svg
            className="w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="검색 (프로젝트, 사람, 태그...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0]/60 focus:bg-white border border-transparent focus:border-peri-500 text-sm font-medium text-[#0F172A] placeholder:text-[#64748B] focus:outline-none transition-all"
          />
        </form>

        {/* Chat Icon */}
        <button
          type="button"
          onClick={() => navigate(`/ws/${effectiveWsId}/chat/team-team-alpha`)}
          aria-label="팀 메신저"
          title="팀 메신저"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#334155] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>

        {/* Settings Icon */}
        <button
          type="button"
          onClick={() => navigate(`/ws/${effectiveWsId}/settings`)}
          aria-label="워크스페이스 설정"
          title="워크스페이스 설정"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#334155] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Notification Bell + Solid Periwinkle Count Pill (Matches Reference 02 Header Right) */}
        <div className="relative" ref={notiRef}>
          <button
            type="button"
            onClick={() => setNotiOpen((prev) => !prev)}
            aria-label="알림"
            className="w-8 h-8 rounded-full bg-peri-500 hover:bg-peri-600 text-white text-xs font-extrabold flex items-center justify-center shadow-2xs transition-colors cursor-pointer tabular-nums"
          >
            {unreadNotificationCount || 3}
          </button>

          {notiOpen && (
            <div className="absolute right-0 mt-2.5 w-88 bg-white rounded-2xl shadow-craft-lg border border-[#E2E8F0] overflow-hidden z-50">
              <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
                <span className="text-sm font-bold text-[#0F172A]">
                  최근 알림 ({unreadNotificationCount})
                </span>
                {unreadNotificationCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-bold text-peri-600 hover:underline cursor-pointer"
                  >
                    모두 읽음
                  </button>
                )}
              </div>
              <div className="divide-y divide-[#F1F5F9] max-h-80 overflow-y-auto">
                {notifications.slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id);
                      setNotiOpen(false);
                      navigate(n.deepLink);
                    }}
                    className={`w-full text-left px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors flex items-start gap-3 cursor-pointer ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        n.read ? 'bg-[#CBD5E1]' : 'bg-peri-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#0F172A] truncate">{n.title}</p>
                      <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">{n.message}</p>
                    </div>
                  </button>
                ))}
              </div>
              <Link
                to="/notifications"
                onClick={() => setNotiOpen(false)}
                className="block py-3 text-center text-xs font-bold text-peri-600 bg-[#F8FAFC] hover:bg-peri-50 border-t border-[#E2E8F0]"
              >
                전체 알림 센터 열기 →
              </Link>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <Link to="/me" className="ml-0.5">
          <MemberAvatar name={currentUser?.name || '박재현'} size="sm" />
        </Link>
      </div>

      {/* Mobile Right: Hamburger Icon (03. 모바일 대시보드) */}
      <button
        type="button"
        onClick={onToggleMobileNav}
        aria-label="메뉴 열기"
        className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
};
