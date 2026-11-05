import React, { useEffect, useId, useState } from 'react';
import {
  ESCALATION_LABEL,
  HANDLER_LABEL,
  REPORT_ACTION_LABEL,
  REPORT_LIMITS,
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_TARGET_LABEL,
  actionsFor,
  workspaceActionsFor,
  type AdminReport,
  type ReportAction,
  type ReportStatus,
} from '@/renewal/domain/report';
import { relativeTime } from '@/renewal/domain/announcement';
import { Badge, Button, Modal, fieldClassName, toast } from '@/renewal/ui';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

export const STATUS_TONE: Record<ReportStatus, 'warning' | 'primary' | 'neutral' | 'success'> = { RECEIVED: 'warning', REVIEWING: 'primary', DISMISSED: 'neutral', ACTED: 'success' };

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

export interface ReportHandlers {
  start: (reportId: string) => Promise<unknown>;
  resolve: (input: { reportId: string; action: ReportAction; memo?: string }) => Promise<unknown>;
  /** 워크스페이스 운영진만 쓴다 */
  escalate?: (input: { reportId: string; memo?: string }) => Promise<unknown>;
  pending: { start: boolean; resolve: boolean; escalate?: boolean };
}

/**
 * 신고 상세와 조치(17 §5.1). 접수 상태면 검토를 시작하고, 검토 중이면 조치를 고른다.
 * scope가 system이면 시스템 관리자(SCR-SYS-01), workspace면 워크스페이스 운영진의 1차 처리다(17 §2).
 * 운영진은 계정 정지를 고를 수 없고, 대신 운영자에게 넘긴다. 넘긴 신고는 읽기만 한다.
 */
export const ReportDetailModal: React.FC<{ report: AdminReport | null; scope: 'system' | 'workspace'; handlers: ReportHandlers; readOnly?: boolean; onClose: () => void }> = ({
  report,
  scope,
  handlers,
  readOnly = false,
  onClose,
}) => {
  const id = useId();
  const [action, setAction] = useState<ReportAction>('DISMISS');
  const [memo, setMemo] = useState('');
  useEffect(() => {
    setAction('DISMISS');
    setMemo('');
  }, [report?.id]);
  if (!report) return null;
  const { pending } = handlers;
  const busy = pending.start || pending.resolve || Boolean(pending.escalate);
  const severe = action === 'BANNED_WS' || action === 'BANNED_SYSTEM';
  const workspace = scope === 'workspace';
  // 운영진은 넘긴 신고를 처리하지 않는다. 보관된 워크스페이스에서도 읽기만 한다.
  const actionable = !readOnly && !(workspace && report.escalation);
  const actions = workspace ? workspaceActionsFor(report.targetType) : actionsFor(report.targetType);

  const run = async (work: () => Promise<unknown>, done: string, close = true) => {
    try {
      await work();
      toast.success(done);
      if (close) onClose();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  };

  const escalateButton =
    workspace && handlers.escalate ? (
      <Button variant="outline" loading={pending.escalate} disabled={busy && !pending.escalate} onClick={() => run(() => handlers.escalate!({ reportId: report.id, memo }), '운영자에게 넘겼어요.')}>
        운영자에게 넘기기
      </Button>
    ) : null;

  const footer = !actionable ? (
    <Button variant="outline" onClick={onClose}>
      닫기
    </Button>
  ) : report.status === 'RECEIVED' ? (
    <>
      {escalateButton}
      <Button onClick={() => run(() => handlers.start(report.id), '검토를 시작했어요.', false)} loading={pending.start} disabled={busy && !pending.start}>
        검토 시작
      </Button>
    </>
  ) : report.status === 'REVIEWING' ? (
    <>
      <Button variant="outline" onClick={onClose} disabled={busy}>
        닫기
      </Button>
      {escalateButton}
      <Button
        variant={severe ? 'danger' : 'primary'}
        loading={pending.resolve}
        disabled={busy && !pending.resolve}
        onClick={() => run(() => handlers.resolve({ reportId: report.id, action, memo }), ACTION_DONE[action])}
      >
        {REPORT_ACTION_LABEL[action]} 처리
      </Button>
    </>
  ) : (
    <Button variant="outline" onClick={onClose}>
      닫기
    </Button>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      preventClose={busy}
      title={`${REPORT_TARGET_LABEL[report.targetType]} 신고`}
      description={`${report.workspaceName} · ${relativeTime(report.createdAt)} 접수`}
      size="lg"
      footer={footer}
    >
      {workspace && report.escalation && (
        <p role="note" className="mb-4 rounded-lg bg-surface-container px-4 py-3 text-sm text-muted">
          운영자에게 넘긴 신고예요. 운영자가 처리하면 결과가 신고자에게 가요.
        </p>
      )}
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">상태</dt>
        <dd>
          <Badge tone={STATUS_TONE[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Badge>
          {report.action && <span className="ml-2 font-semibold">{REPORT_ACTION_LABEL[report.action]}</span>}
          {report.handledBy && <span className="ml-2 text-muted">{HANDLER_LABEL[report.handledBy]} 처리</span>}
        </dd>
        {report.escalation && (
          <>
            <dt className="text-muted">넘김</dt>
            <dd>{ESCALATION_LABEL[report.escalation]}</dd>
          </>
        )}
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

      {actionable && report.status === 'REVIEWING' && (
        <div className="mt-5">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">조치</legend>
            {actions.map((item) => {
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
          {workspace && <p className="mt-1 text-sm text-muted">계정 정지가 필요하거나 판단하기 어려우면 운영자에게 넘겨 주세요.</p>}
          <label htmlFor={`${id}-memo`} className="mb-1.5 mt-3 block text-sm font-semibold">
            처리 메모 <span className="font-normal text-muted">{workspace ? '(운영진과 운영자만 봐요)' : '(운영자만 봐요)'}</span>
          </label>
          <textarea id={`${id}-memo`} rows={2} value={memo} maxLength={REPORT_LIMITS.memoMax} onChange={(event) => setMemo(event.target.value)} className={fieldClassName(false, 'leading-6')} />
        </div>
      )}
    </Modal>
  );
};
