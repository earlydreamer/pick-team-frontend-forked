import React, { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FlagIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import {
  REPORT_ACTION_LABEL,
  REPORT_LIMITS,
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_TARGET_LABEL,
  actionsFor,
  type AdminReport,
  type ReportAction,
  type ReportStatus,
} from '@/renewal/domain/report';
import { relativeTime } from '@/renewal/domain/announcement';
import { useAdminReports, useMe, useResolveReport, useStartReview } from '@/renewal/data/queries';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Modal, buttonClassName, fieldClassName, toast } from '@/renewal/ui';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

const STATUSES: ReportStatus[] = ['RECEIVED', 'REVIEWING', 'DISMISSED', 'ACTED'];
const STATUS_TONE: Record<ReportStatus, 'warning' | 'primary' | 'neutral' | 'success'> = { RECEIVED: 'warning', REVIEWING: 'primary', DISMISSED: 'neutral', ACTED: 'success' };
const isStatus = (value: string | null): value is ReportStatus => STATUSES.includes(value as ReportStatus);

const ACTION_HINT: Record<ReportAction, string> = {
  DISMISS: '정책 위반이 아니면 기각해요. 신고자에게 결과만 알려요.',
  WARNED: '피신고자에게 경고 알림을 보내요.',
  CONTENT_REMOVED: '원문을 지우고 작성자에게 알려요. 신고 기록의 원문은 남아요.',
  BANNED_WS: '그 워크스페이스에서 차단해요. 팀과 채팅에서 빠지고 다시 합류할 수 없어요.',
  BANNED_SYSTEM: '계정 전체를 정지해요. 로그인할 수 없게 되고 되돌리려면 운영자가 직접 풀어야 해요.',
};

const ACTION_DONE: Record<ReportAction, string> = {
  DISMISS: '신고를 기각했어요.',
  WARNED: '경고를 보냈어요.',
  CONTENT_REMOVED: '콘텐츠를 삭제했어요.',
  BANNED_WS: '워크스페이스에서 차단했어요.',
  BANNED_SYSTEM: '계정을 정지했어요.',
};

/** 신고 상세와 조치. 접수 상태면 검토를 시작하고, 검토 중이면 조치를 고른다(17 §5.1). */
const ReportDetail: React.FC<{ report: AdminReport | null; onClose: () => void }> = ({ report, onClose }) => {
  const id = useId();
  const start = useStartReview();
  const resolve = useResolveReport();
  const [action, setAction] = useState<ReportAction>('DISMISS');
  const [memo, setMemo] = useState('');
  useEffect(() => {
    setAction('DISMISS');
    setMemo('');
  }, [report?.id]);
  if (!report) return null;
  const pending = start.isPending || resolve.isPending;
  const severe = action === 'BANNED_WS' || action === 'BANNED_SYSTEM';

  const run = async (work: () => Promise<unknown>, done: string, close = true) => {
    try {
      await work();
      toast.success(done);
      if (close) onClose();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      preventClose={pending}
      title={`${REPORT_TARGET_LABEL[report.targetType]} 신고`}
      description={`${report.workspaceName} · ${relativeTime(report.createdAt)} 접수`}
      size="lg"
      footer={
        report.status === 'RECEIVED' ? (
          <Button onClick={() => run(() => start.mutateAsync(report.id), '검토를 시작했어요.', false)} loading={start.isPending}>
            검토 시작
          </Button>
        ) : report.status === 'REVIEWING' ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              닫기
            </Button>
            <Button variant={severe ? 'danger' : 'primary'} loading={resolve.isPending} onClick={() => run(() => resolve.mutateAsync({ reportId: report.id, action, memo }), ACTION_DONE[action])}>
              {REPORT_ACTION_LABEL[action]} 처리
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        )
      }
    >
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">상태</dt>
        <dd>
          <Badge tone={STATUS_TONE[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Badge>
          {report.action && <span className="ml-2 font-semibold">{REPORT_ACTION_LABEL[report.action]}</span>}
        </dd>
        <dt className="text-muted">피신고자</dt>
        <dd className="font-semibold">{report.targetAccount.name}</dd>
        <dt className="text-muted">사유</dt>
        <dd>{REPORT_REASON_LABEL[report.reason]}</dd>
        {report.detail && (
          <>
            <dt className="text-muted">설명</dt>
            <dd className="whitespace-pre-line break-words">{report.detail}</dd>
          </>
        )}
        {report.adminMemo && (
          <>
            <dt className="text-muted">처리 메모</dt>
            <dd className="whitespace-pre-line break-words">{report.adminMemo}</dd>
          </>
        )}
      </dl>
      <figure className="mt-4">
        <figcaption className="mb-1 text-sm font-semibold">
          신고 시점 원문 {!report.targetExists && <span className="font-normal text-muted">(지금은 지워졌거나 떠난 대상)</span>}
        </figcaption>
        <blockquote className="whitespace-pre-line break-words rounded-lg bg-surface-low p-3 text-sm leading-6">{report.snapshot}</blockquote>
      </figure>

      {report.status === 'REVIEWING' && (
        <div className="mt-5">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">조치</legend>
            {actionsFor(report.targetType).map((item) => {
              const disabled = item === 'CONTENT_REMOVED' && !report.targetExists;
              return (
                <label key={item} className={`flex min-h-touch items-start gap-2.5 py-1 text-sm ${disabled ? 'text-muted' : 'cursor-pointer'}`}>
                  <input type="radio" name={`${id}-action`} value={item} checked={action === item} disabled={disabled} onChange={() => setAction(item)} className="mt-1 h-4 w-4 accent-primary" />
                  <span>
                    <span className="font-semibold">{REPORT_ACTION_LABEL[item]}</span>
                    <span className="block text-muted">{ACTION_HINT[item]}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <label htmlFor={`${id}-memo`} className="mb-1.5 mt-3 block text-sm font-semibold">
            처리 메모 <span className="font-normal text-muted">(운영자만 봐요)</span>
          </label>
          <textarea id={`${id}-memo`} rows={2} value={memo} maxLength={REPORT_LIMITS.memoMax} onChange={(event) => setMemo(event.target.value)} className={fieldClassName(false, 'leading-6')} />
        </div>
      )}
    </Modal>
  );
};

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
      <p className="mb-4 text-sm text-muted">접수한 신고를 검토하고 조치해요. 신고한 사람은 이 화면에도 보이지 않아요.</p>
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
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {item.targetAccount.name} · {REPORT_REASON_LABEL[item.reason]}
                  </span>
                  <span className="block truncate text-sm text-muted">{item.snapshot}</span>
                </span>
                <span className="text-xs text-muted">
                  {item.workspaceName} · {relativeTime(item.createdAt)}
                </span>
                <Badge tone={STATUS_TONE[item.status]}>{REPORT_STATUS_LABEL[item.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ReportDetail report={open} onClose={() => setOpenId(null)} />
    </div>
  );
};
