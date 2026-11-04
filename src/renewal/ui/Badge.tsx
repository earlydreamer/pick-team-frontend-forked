import React, { ReactNode } from 'react';

type BadgeTone = 'primary' | 'neutral' | 'success' | 'warning' | 'error';

const tones: Record<BadgeTone, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  neutral: 'bg-surface-container text-muted',
  success: 'bg-green-50 text-success ring-1 ring-inset ring-green-200',
  warning: 'bg-amber-50 text-warning ring-1 ring-inset ring-amber-200',
  error: 'bg-red-50 text-danger ring-1 ring-inset ring-red-200',
};

/** 상태 배지. 색과 함께 반드시 텍스트로 의미를 전달한다. */
export const Badge: React.FC<{ tone?: BadgeTone; children: ReactNode; className?: string; icon?: ReactNode }> = ({
  tone = 'primary',
  children,
  className = '',
  icon,
}) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${tones[tone]} ${className}`}>
    {icon && <span className="inline-flex" aria-hidden="true">{icon}</span>}
    {children}
  </span>
);
