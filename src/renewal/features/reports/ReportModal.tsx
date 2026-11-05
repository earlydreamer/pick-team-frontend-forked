import React, { useEffect, useId, useState } from 'react';
import { REPORT_LIMITS, REPORT_REASONS, REPORT_TARGET_LABEL, validateReport, type ReportReason, type ReportTargetType } from '@/renewal/domain/report';
import { useSubmitReport } from '@/renewal/data/queries';
import { Button, Modal, fieldClassName, toast } from '@/renewal/ui';
import { errorMessage } from '@/renewal/features/teamSpace/TaskModals';

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  workspaceId: string;
  /** 대화상자에 보일 대상 설명. 예) 김철수님의 메시지 */
  label: string;
}

/**
 * 신고 제출(17 §4.1). 사유를 고르고, 기타면 설명을 적는다.
 * 신고자는 상대에게 알려지지 않는다는 점을 먼저 밝혀 부담을 줄인다(17 §5.1 신고자 보호).
 */
export const ReportModal: React.FC<{ target: ReportTarget | null; onClose: () => void }> = ({ target, onClose }) => {
  const id = useId();
  const submit = useSubmitReport();
  const [reason, setReason] = useState<ReportReason>('ABUSE');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!target) return;
    setReason('ABUSE');
    setDetail('');
    setError(undefined);
  }, [target]);
  if (!target) return null;

  const send = async () => {
    const problem = validateReport({ reason, detail });
    setError(problem);
    if (problem) return document.getElementById(`${id}-detail`)?.focus();
    try {
      await submit.mutateAsync({ targetType: target.type, targetId: target.id, workspaceId: target.workspaceId, reason, detail });
      toast.success('신고를 접수했어요. 검토한 뒤 결과를 알려 드릴게요.');
      onClose();
    } catch (reasonError) {
      toast.error(errorMessage(reasonError));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      preventClose={submit.isPending}
      title={`${REPORT_TARGET_LABEL[target.type]} 신고`}
      description="신고한 사람은 상대에게 알려지지 않아요. 운영자가 검토한 뒤 결과를 알림으로 알려 드려요."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.isPending}>
            취소
          </Button>
          <Button variant="danger" onClick={send} loading={submit.isPending}>
            신고하기
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-lg bg-surface-low px-3 py-2 text-sm">
        <span className="text-muted">대상</span> <span className="font-semibold">{target.label}</span>
      </p>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">사유</legend>
        {REPORT_REASONS.map((item) => (
          <label key={item.value} className="flex min-h-touch cursor-pointer items-center gap-2.5 text-sm">
            <input type="radio" name={`${id}-reason`} value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} className="h-4 w-4 accent-primary" />
            {item.label}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`${id}-detail`} className="mb-1.5 mt-3 block text-sm font-semibold">
        설명 {reason === 'OTHER' ? <span className="font-normal text-danger">(필수)</span> : <span className="font-normal text-muted">(선택)</span>}
      </label>
      <textarea
        id={`${id}-detail`}
        rows={3}
        value={detail}
        maxLength={REPORT_LIMITS.detailMax}
        onChange={(event) => setDetail(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClassName(Boolean(error), 'leading-6')}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
};
