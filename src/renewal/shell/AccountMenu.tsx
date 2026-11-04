import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { IdentificationIcon, UserCircleIcon, Cog6ToothIcon, ArrowsRightLeftIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/renewal/ui';
import { useMe } from '@/renewal/data/queries';
import { data } from '@/renewal/data';
import { mockPersonas, switchMockPersona } from '@/renewal/data/mock/adapters';

/**
 * 아바타 드롭다운(02 §2.1): 마이페이지, 내 PR 카드, 계정 설정, 로그아웃.
 * 목업 데이터에서는 시연용 계정 전환을 함께 둔다.
 */
export const AccountMenu: React.FC = () => {
  const { data: me } = useMe();
  const client = useQueryClient();
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
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!me) return null;

  const itemClass = 'flex min-h-touch w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink hover:bg-surface-container';
  const close = () => setOpen(false);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`내 계정: ${me.name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container"
      >
        <Avatar name={me.name} imageUrl={me.profileImageUrl} size="sm" />
      </button>
      {open && (
        <div id={menuId} className="absolute right-0 top-full z-[60] mt-2 w-64 rounded-card border border-outline-soft bg-surface p-2 shadow-float">
          <div className="border-b border-outline-soft px-2 pb-3 pt-1">
            <p className="truncate text-sm font-bold">{me.name}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
          </div>
          <ul className="py-2">
            <li>
              <Link to="/me" className={itemClass} onClick={close}>
                <UserCircleIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                마이페이지
              </Link>
            </li>
            <li>
              <Link to="/me/card" className={itemClass} onClick={close}>
                <IdentificationIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                내 PR 카드
              </Link>
            </li>
            <li>
              <Link to="/me/settings" className={itemClass} onClick={close}>
                <Cog6ToothIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                계정 설정
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={itemClass}
                onClick={async () => {
                  close();
                  await data.session.signOut();
                  client.clear();
                  navigate('/login', { replace: true });
                }}
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                로그아웃
              </button>
            </li>
          </ul>
          {data.kind === 'mock' && (
            <div className="border-t border-outline-soft pt-2">
              <p className="flex items-center gap-1.5 px-3 pb-1 text-xs font-semibold text-muted">
                <ArrowsRightLeftIcon className="h-4 w-4" aria-hidden="true" />
                목업 계정 전환
              </p>
              <ul>
                {mockPersonas.map((persona) => (
                  <li key={persona.id}>
                    <button
                      type="button"
                      className="flex min-h-touch w-full flex-col items-start justify-center rounded-lg px-3 py-1.5 text-left text-sm font-medium text-ink hover:bg-surface-container"
                      aria-current={persona.id === me.id ? 'true' : undefined}
                      onClick={() => {
                        switchMockPersona(persona.id);
                        close();
                        navigate('/');
                        client.resetQueries();
                      }}
                    >
                      <span>
                        {persona.label}
                        {persona.id === me.id && <span className="ml-1 text-xs text-primary">(현재)</span>}
                      </span>
                      <span className="text-xs font-normal text-muted">{persona.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
