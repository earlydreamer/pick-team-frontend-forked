import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FlagIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { ESCALATION_LABEL, REPORT_REASON_LABEL, REPORT_STATUS_LABEL, REPORT_TARGET_LABEL, type ReportStatus } from '@/renewal/domain/report';
import { relativeTime } from '@/renewal/domain/announcement';
import { useAdminReports, useMe, useResolveReport, useStartReview } from '@/renewal/data/queries';
import { Badge, Button, EmptyState, ErrorState, LoadingState, buttonClassName } from '@/renewal/ui';
import { ReportDetailModal, STATUS_TONE } from './ReportDetailModal';

const STATUSES: ReportStatus[] = ['RECEIVED', 'REVIEWING', 'DISMISSED', 'ACTED'];
const isStatus = (value: string | null): value is ReportStatus => STATUSES.includes(value as ReportStatus);

/**
 * SCR-SYS-01 신고 처리(17 §4.1, 17-D1). 시스템 관리자 전용이다. ?status=로 상태를 거른다.
 * 신고자 정보는 이 화면에도 보이지 않는다(17 §5.1 신고자 보호).
 */
export const AdminReportsScreen: React.FC = () => {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status = isStatus(raw) ? raw : undefined;
  const isAdmin = me.data?.systemRole === 'ADMIN';
  const reports = useAdminReports(isAdmin ? status : undefined);
  const start = useStartReview();
  const resolve = useResolveReport();
  const [openId, setOpenId] = useState<string | null>(null);

  if (me.isLoading) return <LoadingState className="min-h-[60vh]" />;
  if (!isAdmin) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={<ShieldExclamationIcon className="h-7 w-7" />}
        title="시스템 관리자만 볼 수 있는 화면이에요"
        action={
          <Link to="/" className={buttonClassName('primary')}>
            처음으로
          </Link>
        }
      />
    );
  }

  const open = reports.data?.find((item) => item.id === openId) ?? null;
  const filters: { value?: ReportStatus; label: string }[] = [{ label: '전체' }, ...STATUSES.map((value) => ({ value, label: REPORT_STATUS_LABEL[value] }))];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="mb-1 text-2xl font-bold leading-8">신고 처리</h1>
      <p className="mb-4 text-sm text-muted">모든 워크스페이스의 신고를 검토하고 조치해요. 계정 정지는 여기서만 할 수 있고, 신고한 사람은 이 화면에도 보이지 않아요.</p>
      <nav aria-label="신고 상태" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 whitespace-nowrap">
          {filters.map((filter) => (
            <li key={filter.label}>
              <Link
                to={filter.value ? `?status=${filter.value}` : '?'}
                onClick={(event) => {
                  event.preventDefault();
                  setParams(filter.value ? { status: filter.value } : {}, { replace: true });
                }}
                aria-current={filter.value === status ? 'page' : undefined}
                className={`inline-flex min-h-touch items-center rounded-full px-4 text-sm font-semibold ${
                  filter.value === status ? 'bg-primary text-on-primary' : 'bg-surface text-muted ring-1 ring-inset ring-outline-soft hover:text-ink'
                }`}
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {reports.isLoading ? (
        <LoadingState label="신고를 불러오는 중이에요" />
      ) : reports.isError || !reports.data ? (
        <ErrorState title="신고를 불러오지 못했어요" action={<Button onClick={() => reports.refetch()}>다시 시도</Button>} />
      ) : reports.data.length === 0 ? (
        <div className="rounded-card border border-dashed border-outline-soft bg-surface">
          <EmptyState compact icon={<FlagIcon className="h-5 w-5" />} title={status ? `${REPORT_STATUS_LABEL[status]} 상태인 신고가 없어요` : '접수된 신고가 없어요'} />
        </div>
      ) : (
        <ul className="divide-y divide-outline-soft overflow-hidden rounded-card border border-outline-soft bg-surface">
          {reports.data.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setOpenId(item.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-surface-container">
                <Badge tone="neutral">{REPORT_TARGET_LABEL[item.targetType]}</Badge>
                <span className="min-w-[12rem] flex-1">
                  <span className="block truncate font-semibold">
                    {item.targetAccount.name} · {REPORT_REASON_LABEL[item.reason]}
                  </span>
                  <span className="block truncate text-sm text-muted">{item.snapshot}</span>
                </span>
                <span className="text-xs text-muted">
                  {item.workspaceName} · {relativeTime(item.createdAt)}
                </span>
                {item.escalation && <Badge tone="warning">{ESCALATION_LABEL[item.escalation]}</Badge>}
                <Badge tone={STATUS_TONE[item.status]}>{REPORT_STATUS_LABEL[item.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ReportDetailModal
        report={open}
        scope="system"
        handlers={{ start: start.mutateAsync, resolve: resolve.mutateAsync, pending: { start: start.isPending, resolve: resolve.isPending } }}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
};
