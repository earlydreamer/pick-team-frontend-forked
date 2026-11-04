import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BellIcon, Cog6ToothIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  CATEGORY_LABEL,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PAGE_SIZE,
  dayGroup,
  type AppNotification,
  type NotificationCategory,
} from '@/renewal/domain/notification';
import { useMarkAllRead, useMarkNotificationRead, useMyWorkspaces, useNotifications, useRemoveNotification } from '@/renewal/data/queries';
import { Button, EmptyState, ErrorState, LoadingState, toast } from '@/renewal/ui';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';
import { CategoryIcon, NotificationMeta } from './NotificationItem';

const isCategory = (value: string | null): value is NotificationCategory => NOTIFICATION_CATEGORIES.includes(value as NotificationCategory);
const clock = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 날짜 묶음(오늘, 어제, 날짜)으로 나눈다. 목록은 이미 최신순이다. */
const groupByDay = (items: AppNotification[]) => {
  const groups: { label: string; items: AppNotification[] }[] = [];
  items.forEach((item) => {
    const label = dayGroup(item.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  });
  return groups;
};

/**
 * 알림 센터(SCR-NOTI-01, 16 §4.2). 워크스페이스 밖의 전역 화면이다.
 * 계열 필터는 ?category=로 둔다. 항목을 누르면 읽음 처리하고 딥링크로 간다. 20건씩 더 불러온다.
 */
export const NotificationsScreen: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('category');
  const category = isCategory(raw) ? raw : undefined;
  const [limit, setLimit] = useState(NOTIFICATION_PAGE_SIZE);
  const list = useNotifications(category, limit);
  const workspaces = useMyWorkspaces();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const remove = useRemoveNotification();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [focusAfterDelete, setFocusAfterDelete] = useState<string | null>(null);

  useEffect(() => setLimit(NOTIFICATION_PAGE_SIZE), [category]);

  // 지운 항목 다음 알림으로 포커스를 옮긴다. 다음이 없으면 제목으로 돌아간다.
  useEffect(() => {
    if (!focusAfterDelete) return;
    const target = focusAfterDelete === 'heading' ? headingRef.current : document.getElementById(`noti-${focusAfterDelete}`);
    if (target) {
      target.focus();
      setFocusAfterDelete(null);
    }
  }, [focusAfterDelete, list.data]);

  const items = list.data?.items ?? [];
  const showWorkspace = (workspaces.data?.length ?? 0) > 1;
  const workspaceName = (id?: string) => (showWorkspace ? workspaces.data?.find((workspace) => workspace.id === id)?.name : undefined);
  const hasUnread = items.some((item) => !item.read) || Boolean(list.data?.hasMore);

  const onDelete = async (item: AppNotification) => {
    const index = items.findIndex((entry) => entry.id === item.id);
    const next = items[index + 1] ?? items[index - 1];
    try {
      await remove.mutateAsync(item.id);
      setFocusAfterDelete(next ? next.id : 'heading');
      toast.success('알림을 지웠어요.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  };

  const onMarkAll = async () => {
    try {
      await markAll.mutateAsync(category);
      toast.success(category ? `${CATEGORY_LABEL[category]} 알림을 모두 읽음으로 바꿨어요.` : '알림을 모두 읽음으로 바꿨어요.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  };

  const filters: { value?: NotificationCategory; label: string }[] = [{ label: '전체' }, ...NOTIFICATION_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] }))];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-8 focus:outline-none">
          알림
        </h1>
        <div className="flex items-center gap-2">
          <Link to="/me/settings" className="inline-flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-container hover:text-ink">
            <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
            수신 설정
          </Link>
          <Button variant="outline" size="sm" onClick={onMarkAll} loading={markAll.isPending} disabled={!hasUnread}>
            모두 읽음
          </Button>
        </div>
      </div>

      <nav aria-label="알림 계열" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 whitespace-nowrap">
          {filters.map((filter) => {
            const active = filter.value === category;
            return (
              <li key={filter.label}>
                <Link
                  to={filter.value ? `?category=${filter.value}` : '?'}
                  onClick={(event) => {
                    event.preventDefault();
                    setParams(filter.value ? { category: filter.value } : {}, { replace: true });
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-touch items-center rounded-full px-4 text-sm font-semibold ${
                    active ? 'bg-primary text-on-primary' : 'bg-surface text-muted ring-1 ring-inset ring-outline-soft hover:text-ink'
                  }`}
                >
                  {filter.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {list.isLoading ? (
        <LoadingState label="알림을 불러오는 중이에요" />
      ) : list.isError ? (
        <ErrorState title="알림을 불러오지 못했어요" description="네트워크 상태를 확인한 뒤 다시 시도해 주세요." action={<Button onClick={() => list.refetch()}>다시 시도</Button>} />
      ) : items.length === 0 ? (
        <div className="rounded-card border border-dashed border-outline-soft bg-surface">
          <EmptyState
            compact
            icon={<BellIcon className="h-5 w-5" />}
            title={category ? `${CATEGORY_LABEL[category]} 알림이 없어요` : '알림이 없어요'}
            description="팀 빌딩, 칸반, 채팅 같은 활동이 생기면 여기에 쌓여요."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groupByDay(items).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{group.label}</h2>
              <ul className="divide-y divide-outline-soft overflow-hidden rounded-card border border-outline-soft bg-surface">
                {group.items.map((item) => (
                  <li key={item.id} className={`flex items-start gap-1 pr-1 ${item.read ? '' : 'bg-peri-50/60'}`}>
                    <Link
                      id={`noti-${item.id}`}
                      to={item.link}
                      onClick={() => {
                        if (!item.read) markRead.mutate(item.id);
                      }}
                      className="flex min-w-0 flex-1 gap-3 px-4 py-3 hover:bg-surface-container"
                    >
                      <CategoryIcon category={item.category} read={item.read} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${item.read ? 'text-muted' : 'font-semibold'}`}>{item.title}</span>
                        <NotificationMeta item={item} workspaceName={workspaceName(item.workspaceId)} time={clock(item.createdAt)} />
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      disabled={remove.isPending}
                      aria-label={`알림 지우기: ${item.title}`}
                      className="mt-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-container hover:text-danger disabled:opacity-55"
                    >
                      <TrashIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {list.data?.hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit((value) => value + NOTIFICATION_PAGE_SIZE)} loading={list.isPlaceholderData}>
                더 보기
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
