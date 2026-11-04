import React, { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarIcon } from '@heroicons/react/20/solid';
import { ROLE_LABEL, type GoalTemperature } from '@/renewal/domain/card';
import { APPLICATION_STATUS_LABEL, TEAM_BUILDING_RULES, type ApplicationStatus, type RecruitRole } from '@/renewal/domain/teamBuilding';
import type { MatchResult } from '@/renewal/domain/matching';
import { Badge, Button, Modal, fieldClassName, toast } from '@/renewal/ui';
import { DataError } from '@/renewal/data';

/** 적합도 ★ 5단계(12-D2). 숫자 점수는 보여 주지 않는다. */
export const Stars: React.FC<{ value: MatchResult['stars'] }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" role="img" aria-label={`적합도 별 5개 중 ${value}개`}>
    {[1, 2, 3, 4, 5].map((step) => (
      <StarIcon key={step} className={`h-4 w-4 ${step <= value ? 'text-amber-500' : 'text-neutral-300'}`} aria-hidden="true" />
    ))}
  </span>
);

/** 추천 사유. 모든 추천에 사유를 붙인다(00 §5-3). */
export const FitReasons: React.FC<{ fit: MatchResult; compact?: boolean }> = ({ fit, compact }) => (
  <div className={`rounded-lg bg-peri-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
    <p className="text-xs font-semibold text-primary">추천 사유</p>
    <p className="mt-0.5 text-sm leading-5 text-ink">{fit.reasons.join(' · ')}</p>
  </div>
);

export const temperatureLabel = (value?: number) =>
  value === undefined ? undefined : value >= 3.5 ? '수상 지향' : value <= 2.5 ? '완주 지향' : '중간';

export const GoalTag: React.FC<{ value?: GoalTemperature | number }> = ({ value }) =>
  value === undefined ? null : <span className="text-sm text-muted">목표 {temperatureLabel(value)}</span>;

export const RecruitRoleChips: React.FC<{ roles: RecruitRole[] }> = ({ roles }) =>
  roles.length === 0 ? null : (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-sm text-muted">모집</span>
      {roles.map((recruit) => (
        <span key={recruit.role} className="rounded-md bg-surface-container px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink">
          {ROLE_LABEL[recruit.role]} {recruit.count}
        </span>
      ))}
    </span>
  );

const statusTone: Record<ApplicationStatus, 'primary' | 'neutral' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  WITHDRAWN: 'neutral',
  AUTO_WITHDRAWN: 'neutral',
  EXPIRED: 'neutral',
};

export const ApplicationStatusBadge: React.FC<{ status: ApplicationStatus }> = ({ status }) => (
  <Badge tone={statusTone[status]}>{APPLICATION_STATUS_LABEL[status]}</Badge>
);

/**
 * 지원·스카우트 메시지 입력. 메시지는 선택이며 200자까지다(12 §4.2).
 */
export const ProposalModal: React.FC<{
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
}> = ({ open, title, description, submitLabel, pending, onClose, onSubmit }) => {
  const id = useId();
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (open) setMessage('');
  }, [open]);
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={() => onSubmit(message)} loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        한마디 <span className="font-normal text-muted">(선택)</span>
      </label>
      <textarea
        id={id}
        rows={3}
        value={message}
        maxLength={TEAM_BUILDING_RULES.messageMax}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="예: 저녁 시간에 꾸준히 참여할 수 있어요."
        aria-describedby={`${id}-count`}
        className={fieldClassName(false, 'leading-6')}
      />
      <p id={`${id}-count`} className="mt-1 text-right text-xs text-muted tabular-nums">
        {message.length}/{TEAM_BUILDING_RULES.messageMax}자
      </p>
    </Modal>
  );
};

/** 카드 없이 지원하려 할 때 카드 작성으로 안내한다(11-D5). */
export const CardRequiredModal: React.FC<{ open: boolean; workspaceId: string; message?: string; onClose: () => void }> = ({ open, workspaceId, message, onClose }) => {
  const navigate = useNavigate();
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="PR 카드가 필요해요"
      description={message ?? '지원하거나 팀을 만들려면 먼저 PR 카드를 만들어 공개해 주세요.'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={() => navigate(`/ws/${workspaceId}/onboarding`)}>카드 만들기</Button>
        </>
      }
    >
      {null}
    </Modal>
  );
};

/** 팀 빌딩 행동의 오류 처리: 카드가 필요하면 안내 대화상자를, 그 밖에는 오류 토스트를 띄운다. */
export const useActionErrorHandler = () => {
  const [cardRequired, setCardRequired] = useState<string | null>(null);
  const handle = (error: unknown) => {
    if (error instanceof DataError && error.code === 'CARD_REQUIRED') {
      setCardRequired(error.message);
      return;
    }
    toast.error(error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.');
  };
  return { cardRequired, clearCardRequired: () => setCardRequired(null), handle };
};

/** 되돌릴 수 없는 행동의 확인. 결과는 description 한 문장으로 알린다. */
export const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 되돌리기 어려운 행동이면 danger로 확인 버튼을 빨갛게 한다 */
  tone?: 'default' | 'danger';
}> = ({ open, title, description, confirmLabel, pending, onClose, onConfirm, tone = 'default' }) => (
  <Modal
    isOpen={open}
    onClose={onClose}
    preventClose={pending}
    title={title}
    description={description}
    size="sm"
    footer={
      <>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          취소
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    {null}
  </Modal>
);
