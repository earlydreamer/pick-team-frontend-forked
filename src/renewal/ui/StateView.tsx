import React, { ReactNode } from 'react';

interface StateViewProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** 영역 안에서 작게 표시할 때 사용한다. */
  compact?: boolean;
}

const Frame: React.FC<StateViewProps & { role?: string; ariaLive?: 'polite' | 'assertive' }> = ({
  title,
  description,
  icon,
  action,
  className = '',
  compact,
  role,
  ariaLive,
}) => (
  <div
    role={role}
    aria-live={ariaLive}
    className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'} ${className}`}
  >
    {icon && (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}
        aria-hidden="true"
      >
        {icon}
      </span>
    )}
    <p className={`font-bold text-ink ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
    {description && <div className="max-w-sm text-sm leading-5 text-muted">{description}</div>}
    {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

/** 빈 상태: 가능한 다음 행동을 함께 제공한다. */
export const EmptyState: React.FC<StateViewProps> = (props) => <Frame {...props} />;

/** 오류 상태: 원인과 복구 방법(다시 시도 등)을 함께 제공한다. */
export const ErrorState: React.FC<StateViewProps> = (props) => <Frame {...props} role="alert" />;

/** 로딩 상태 */
export const LoadingState: React.FC<{ label?: string; className?: string; compact?: boolean }> = ({
  label = '불러오는 중이에요',
  className = '',
  compact,
}) => (
  <div role="status" className={`flex items-center justify-center gap-3 text-sm text-muted ${compact ? 'py-6' : 'py-14'} ${className}`}>
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

/** 목록 자리 표시용 스켈레톤 */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`block animate-pulse rounded-md bg-surface-container ${className}`} aria-hidden="true" />
);
