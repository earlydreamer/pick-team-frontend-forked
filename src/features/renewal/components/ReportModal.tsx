import React, { useState } from 'react';
import { Modal, Button, TextArea } from '@/components/ui';
import { useRenewal } from '../context/RenewalContext';
import { ReportTargetType, ReportReasonType } from '../types/renewal';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  targetContentSnippet: string;
}

const REASON_OPTIONS: { value: ReportReasonType; label: string; desc: string }[] = [
  { value: 'ABUSE', label: '욕설·비하·혐오 표현', desc: '타인을 모욕하거나 불쾌감을 주는 언행' },
  { value: 'SPAM', label: '스팸·반복 도배·외부 홍보', desc: '무관한 광고 링크나 도배성 게시물' },
  { value: 'PRIVACY', label: '개인정보 침해·무단 노출', desc: '타인의 연락처·신상정보 무단 기재' },
  { value: 'OTHER', label: '기타 운영정책 위반', desc: '부트캠프 학습 분위기를 해치는 행위' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  targetType,
  targetId,
  targetLabel,
  targetContentSnippet,
}) => {
  const { submitSafetyReport } = useRenewal();
  const [reason, setReason] = useState<ReportReasonType>('ABUSE');
  const [reasonDetail, setReasonDetail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSafetyReport({
      workspaceId,
      targetType,
      targetId,
      targetLabel,
      targetContentSnippet,
      reason,
      reasonDetail: reasonDetail.trim() || undefined,
    });
    setReasonDetail('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="신고 제출"
      subtitle="신고자 정보는 상대방에게 절대 공개되지 않으며 운영진이 검토 후 조치합니다. (17 §5.1)"
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button variant="danger" size="sm" onClick={handleSubmit}>
            신고 제출하기
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-neutral-200">
          <div className="text-xs font-semibold text-ink-tertiary">신고 대상 ({targetType})</div>
          <div className="text-sm font-bold text-ink-primary mt-0.5">{targetLabel}</div>
          {targetContentSnippet && (
            <p className="text-xs text-ink-secondary mt-1 line-clamp-2 italic">
              "{targetContentSnippet}"
            </p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs sm:text-sm font-semibold text-ink-primary mb-2">
            신고 사유 선택 <span className="text-red-700 font-bold">*필수</span>
          </legend>
          {REASON_OPTIONS.map((opt) => {
            const selected = reason === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selected
                    ? 'border-peri-600 bg-peri-50/70 text-ink-primary'
                    : 'border-neutral-200 hover:border-peri-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setReason(opt.value)}
                  className="mt-1 h-4 w-4 accent-peri-600"
                />
                <div>
                  <div className="text-sm font-bold text-ink-primary">{opt.label}</div>
                  <div className="text-xs text-ink-tertiary">{opt.desc}</div>
                </div>
              </label>
            );
          })}
        </fieldset>

        <TextArea
          label="추가 상세 설명 (선택)"
          name="reasonDetail"
          placeholder="상황 파악에 도움이 될 추가 설명을 입력해 주세요 (최대 300자)"
          maxLength={300}
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
        />
      </form>
    </Modal>
  );
};
