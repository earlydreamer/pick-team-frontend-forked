import React from 'react';
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import { CATEGORY_LABEL, type AppNotification, type NotificationCategory } from '@/renewal/domain/notification';

const ICON: Record<NotificationCategory, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  TEAM_BUILDING: UserGroupIcon,
  KANBAN: ViewColumnsIcon,
  SCHEDULE: CalendarDaysIcon,
  ANNOUNCEMENT: MegaphoneIcon,
  CHAT: ChatBubbleLeftRightIcon,
  MEMBERSHIP: ShieldCheckIcon,
};

/** 계열 아이콘. 색이 아니라 모양과 글자로 계열을 구분한다. */
export const CategoryIcon: React.FC<{ category: NotificationCategory; read: boolean }> = ({ category, read }) => {
  const Icon = ICON[category];
  return (
    <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${read ? 'bg-surface-container text-muted' : 'bg-primary-container text-on-primary-container'}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
};

/** 제목 옆에 붙는 정보: 안 읽음, 계열, 워크스페이스, 시각. 안 읽음은 점과 함께 화면 낭독기용 글자로도 알린다. */
export const NotificationMeta: React.FC<{ item: AppNotification; workspaceName?: string; time: string }> = ({ item, workspaceName, time }) => (
  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
    {!item.read && (
      <>
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
        <span className="sr-only">안 읽음,</span>
      </>
    )}
    <span>{CATEGORY_LABEL[item.category]}</span>
    {workspaceName && (
      <>
        <span aria-hidden="true">·</span>
        <span className="truncate">{workspaceName}</span>
      </>
    )}
    <span aria-hidden="true">·</span>
    <span>{time}</span>
  </span>
);
