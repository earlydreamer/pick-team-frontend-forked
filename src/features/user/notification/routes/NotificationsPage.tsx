import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useRenewal } from '@/features/renewal/context/RenewalContext';
import { NotificationCategory } from '@/features/renewal/types/renewal';

const CATEGORY_TABS: { id: 'ALL' | NotificationCategory; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'TEAM_BUILDING', label: '팀 빌딩' },
  { id: 'KANBAN', label: '칸반 · 승인' },
  { id: 'SCHEDULE', label: '일정' },
  { id: 'BOARD', label: '공지 · 게시판' },
  { id: 'CHAT', label: '메신저' },
];

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  } = useRenewal();

  const [selectedCategory, setSelectedCategory] = useState<'ALL' | NotificationCategory>('ALL');

  const filteredList = useMemo(() => {
    if (selectedCategory === 'ALL') return notifications;
    return notifications.filter((n) => n.category === selectedCategory);
  }, [notifications, selectedCategory]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            알림 센터
          </h1>
          <p className="text-xs sm:text-sm text-ink-tertiary mt-1">
            팀 빌딩 제안과 작업 승인, 일정 리마인더를 한곳에서 확인하세요.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/me/settings">
            <Button variant="outline" size="sm">
              알림 설정
            </Button>
          </Link>
          {unreadNotificationCount > 0 && (
            <Button variant="primary" size="sm" onClick={markAllNotificationsRead}>
              모두 읽음
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => {
          const active = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'bg-peri-500 text-white shadow-2xs'
                  : 'bg-white border border-neutral-200 text-ink-secondary hover:bg-surface-subtle'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200/85 divide-y divide-neutral-100 shadow-craft-sm overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="py-14 text-center text-xs sm:text-sm text-ink-tertiary">
            새로운 알림이 없습니다.
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                markNotificationRead(item.id);
                navigate(item.deepLink);
              }}
              className={`p-4 sm:px-6 hover:bg-surface-subtle/60 transition-colors flex items-center justify-between gap-4 cursor-pointer ${
                item.read ? 'opacity-65' : ''
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    item.read ? 'bg-neutral-300' : 'bg-peri-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-ink-primary truncate">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-ink-tertiary tabular-nums shrink-0">
                      {item.createdAt}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary mt-0.5 truncate">{item.message}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(item.id);
                }}
                className="text-xs text-ink-tertiary hover:text-rose-600 shrink-0 cursor-pointer"
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
