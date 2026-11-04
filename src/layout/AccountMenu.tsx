import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightStartOnRectangleIcon, UserCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/user/auth/hooks/useAuth';
import { Avatar } from '@/components/ui';

/**
 * 계정 메뉴: 프로필 버튼을 누르면 마이페이지·계정 설정·로그아웃을 펼칩니다.
 * 바깥을 누르거나 Escape를 누르면 닫히고 포커스는 버튼으로 돌아갑니다.
 */
export const AccountMenu: React.FC<{ placement: 'rail' | 'topbar'; onNavigate?: () => void }> = ({ placement, onNavigate }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  if (!currentUser) return null;

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  const handleLogout = async () => {
    close();
    await logout();
    navigate('/login');
  };

  const panelPosition =
    placement === 'rail' ? 'bottom-0 left-full ml-3' : 'right-0 top-full mt-2';
  const itemClass =
    'flex min-h-touch w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink hover:bg-surface-container';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`내 계정: ${currentUser.name || currentUser.email}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container"
      >
        <Avatar name={currentUser.name || currentUser.email} imageUrl={currentUser.profileImageUrl} size="sm" />
      </button>
      {open && (
        <div
          id={menuId}
          className={`absolute z-[60] w-60 rounded-card border border-outline-soft bg-surface p-2 shadow-float ${panelPosition}`}
        >
          <div className="flex items-center gap-3 border-b border-outline-soft px-2 pb-3 pt-1">
            <Avatar name={currentUser.name || currentUser.email} imageUrl={currentUser.profileImageUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{currentUser.name || '이름 없음'}</p>
              <p className="truncate text-xs text-muted">{currentUser.email}</p>
            </div>
          </div>
          <ul className="pt-2">
            <li>
              <Link to="/my-page" className={itemClass} onClick={close}>
                <UserCircleIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                마이페이지
              </Link>
            </li>
            <li>
              <Link to="/my-page/account-settings" className={itemClass} onClick={close}>
                <Cog6ToothIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                계정 설정
              </Link>
            </li>
            <li>
              <button type="button" className={itemClass} onClick={handleLogout}>
                <ArrowRightStartOnRectangleIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                로그아웃
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
