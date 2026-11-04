import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { relativeTime } from '@/renewal/domain/announcement';
import { previewItems } from '@/renewal/domain/notification';
import { useMarkNotificationRead, useMyWorkspaces, useNotifications, useUnreadSummary } from '@/renewal/data/queries';
import { CategoryIcon, NotificationMeta } from '@/renewal/features/notifications/NotificationItem';

const badgeText = (count: number) => (count > 99 ? '99+' : String(count));

/**
 * 전역 헤더의 알림 벨(16 §4.1). 배지는 전체 미확인 수이고 0이면 숨긴다.
 * 드롭다운은 높음·보통 우선순위의 최신 5개를 보여 준다. 항목을 누르면 읽음 처리하고 딥링크로 간다.
 * 새 알림이 오면 화면 낭독기에 한 번 알린다.
 */
export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const summary = useUnreadSummary(true);
  const list = useNotifications(undefined, 20, open);
  const workspaces = useMyWorkspaces();
  const markRead = useMarkNotificationRead();
  const total = summary.data?.total ?? 0;

  const [announcement, setAnnouncement] = useState('');
  const previousTotal = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (summary.data === undefined) return;
    if (previousTotal.current !== undefined && total > previousTotal.current) setAnnouncement(`새 알림 ${total - previousTotal.current}개`);
    previousTotal.current = total;
  }, [summary.data, total]);

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

  const items = previewItems(list.data?.items ?? []);
  const showWorkspace = (workspaces.data?.length ?? 0) > 1;
  const workspaceName = (id?: string) => (showWorkspace ? workspaces.data?.find((workspace) => workspace.id === id)?.name : undefined);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={total > 0 ? `알림, 안 읽은 알림 ${total}개` : '알림'}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-container hover:text-ink"
      >
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {total > 0 && (
          <span aria-hidden="true" className="absolute right-1 top-1 min-w-[1.125rem] rounded-full bg-danger px-1 text-center text-[0.6875rem] font-bold leading-[1.125rem] text-white tabular-nums">
            {badgeText(total)}
          </span>
        )}
      </button>
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {open && (
        <div
          id={panelId}
          className="fixed inset-x-2 top-[60px] z-[60] rounded-card border border-outline-soft bg-surface shadow-float sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <h2 className="border-b border-outline-soft px-4 py-3 text-sm font-bold">최근 알림</h2>
          {list.isLoading ? (
            <p role="status" className="px-4 py-6 text-center text-sm text-muted">
              알림을 불러오는 중이에요
            </p>
          ) : list.isError ? (
            <p role="alert" className="px-4 py-6 text-center text-sm text-muted">
              알림을 불러오지 못했어요.{' '}
              <button type="button" className="font-semibold text-primary underline" onClick={() => list.refetch()}>
                다시 시도
              </button>
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">새 알림이 없어요.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.link}
                    onClick={() => {
                      if (!item.read) markRead.mutate(item.id);
                      setOpen(false);
                    }}
                    className={`flex gap-3 px-4 py-2.5 hover:bg-surface-container ${item.read ? 'text-muted' : ''}`}
                  >
                    <CategoryIcon category={item.category} read={item.read} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${item.read ? '' : 'font-semibold text-ink'}`}>{item.title}</span>
                      <NotificationMeta item={item} workspaceName={workspaceName(item.workspaceId)} time={relativeTime(item.createdAt)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-outline-soft p-2">
            <Link to="/notifications" onClick={() => setOpen(false)} className="flex min-h-touch items-center justify-center rounded-lg text-sm font-semibold text-primary hover:bg-surface-container">
              알림 모두 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
