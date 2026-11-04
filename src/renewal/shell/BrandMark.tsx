import React from 'react';

/** Pick Team 로고 표식. 파비콘(public/favicon.svg)과 같은 도형이다. */
export const BrandMark: React.FC<{ className?: string }> = ({ className = 'h-8 w-8' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="8" fill="var(--ds-primary-fill)" />
    <path
      d="M11 24V8h6.2c3.6 0 5.8 2 5.8 5.1 0 3.2-2.2 5.2-5.8 5.2H14.6V24H11Zm3.6-8.6h2.3c1.6 0 2.5-.8 2.5-2.3 0-1.4-.9-2.2-2.5-2.2h-2.3v4.5Z"
      fill="var(--ds-on-primary)"
    />
  </svg>
);

/** 로고 표식과 제품명 */
export const BrandLockup: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-2 text-lg font-bold tracking-[-0.01em] text-ink ${className}`}>
    <BrandMark className="h-8 w-8" />
    Pick Team
  </span>
);
