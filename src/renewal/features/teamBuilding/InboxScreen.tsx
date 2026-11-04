import React, { useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, InboxIcon } from '@heroicons/react/24/outline';
import type { ApplicationView } from '@/renewal/domain/teamBuilding';
import { DataError } from '@/renewal/data';
import { useBoard, useInbox, useMe } from '@/renewal/data/queries';
import { Button, EmptyState, ErrorState, LoadingState } from '@/renewal/ui';
import { NotFoundScreen } from '@/renewal/screens/system';
import { ProposalItem } from './ProposalItem';
import { CardRequiredModal, useActionErrorHandler } from './shared';
import { useProposalActions } from './useProposalActions';

type Tab = 'received' | 'sent';
const TABS: { id: Tab; label: string }[] = [
  { id: 'received', label: '받은 제안' },
  { id: 'sent', label: '보낸 제안' },
];

/** 대기 중인 제안을 위로, 같은 상태끼리는 최신순(데이터 계층 정렬)을 유지한다. */
const pendingFirst = (views: ApplicationView[]) =>
  [...views].sort((a, b) => Number(b.application.status === 'PENDING') - Number(a.application.status === 'PENDING'));

/**
 * SCR-TB-03 제안함(12 §4.3). 모든 지원·스카우트를 추적하는 한 곳이며 알림 딥링크가 도착하는 곳이다.
 * 탭은 주소(?tab=sent)에 남겨 새로 고침과 공유에도 유지한다.
 */
export const InboxScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'sent' ? 'sent' : 'received';
  const me = useMe();
  const board = useBoard(wsId);
  const inbox = useInbox(wsId);
  const errors = useActionErrorHandler();
  const actions = useProposalActions(wsId, errors.handle);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ received: null, sent: null });
  const back = `/ws/${wsId}/team-building`;

  if (board.isLoading || inbox.isLoading) return <LoadingState className="min-h-[60vh]" label="제안함을 불러오는 중이에요" />;
  if (board.error instanceof DataError && board.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if (board.isError || inbox.isError || !board.data || !inbox.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="제안함을 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={
          <Button
            onClick={() => {
              board.refetch();
              inbox.refetch();
            }}
          >
            다시 시도
          </Button>
        }
      />
    );
  }

  const { session, teams } = board.data;
  const box = inbox.data;
  const actionable = session.status === 'OPEN';
  const counts: Record<Tab, number> = {
    received: box.received.filter((view) => view.application.status === 'PENDING').length,
    sent: box.sent.filter((view) => view.application.status === 'PENDING').length,
  };
  const items = pendingFirst(box[tab]);
  const seatsOf = (teamId: string) => teams.find((summary) => summary.team.id === teamId)?.openSeats ?? 0;

  const select = (next: Tab, focus = false) => {
    setParams(next === 'sent' ? { tab: 'sent' } : {}, { replace: true });
    if (focus) tabRefs.current[next]?.focus();
  };
  const onTabKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const index = TABS.findIndex((item) => item.id === tab);
      const next =
        event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
      select(TABS[next].id, true);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <Link to={back} className="mb-4 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        팀 빌딩
      </Link>
      <h1 className="text-2xl font-bold leading-8">제안함</h1>
      {!actionable && (
        <p role="status" className="mt-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warning">
          모집이 끝나 제안을 수락하거나 철회할 수 없어요.
        </p>
      )}

      <div role="tablist" aria-label="제안 구분" className="mt-5 flex gap-1 border-b border-outline-soft" onKeyDown={onTabKey}>
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node;
              }}
              id={`inbox-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="inbox-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              className={`-mb-px inline-flex min-h-touch items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${
                selected ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {item.label}
              <span className="tabular-nums">{counts[item.id]}</span>
              <span className="sr-only">건 대기</span>
            </button>
          );
        })}
      </div>

      <div id="inbox-panel" role="tabpanel" aria-labelledby={`inbox-tab-${tab}`} className="mt-4">
        {items.length === 0 ? (
          <div className="rounded-card border border-dashed border-outline-soft bg-surface">
            <EmptyState
              compact
              icon={<InboxIcon className="h-5 w-5" />}
              title={tab === 'received' ? '받은 제안이 없어요' : '보낸 제안이 없어요'}
              description={actionable ? (tab === 'received' ? '카드를 공개해 두면 팀장이 스카우트를 보낼 수 있어요.' : '팀 빌딩 홈에서 마음에 드는 팀에 지원해 보세요.') : undefined}
              action={
                actionable && tab === 'sent' ? (
                  <Link to={back} className="text-sm font-semibold text-primary underline underline-offset-4">
                    팀 빌딩 홈으로
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-outline-soft overflow-hidden rounded-card border border-outline-soft bg-surface">
            {items.map((view) => (
              <ProposalItem
                key={view.application.id}
                view={view}
                box={tab}
                myId={me.data?.id}
                workspaceId={wsId}
                actionable={actionable}
                busy={actions.busyId === view.application.id}
                onAccept={() => actions.requestAccept(view, box, seatsOf(view.application.teamId))}
                onDecline={() => actions.decline(view)}
                onWithdraw={() => actions.withdraw(view)}
              />
            ))}
          </ul>
        )}
      </div>

      {actions.modal}
      <CardRequiredModal open={errors.cardRequired !== null} workspaceId={wsId} message={errors.cardRequired ?? undefined} onClose={errors.clearCardRequired} />
    </div>
  );
};
