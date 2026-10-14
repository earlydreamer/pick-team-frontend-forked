import React, { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  variant?: 'default' | 'admin' | 'highlighted' | 'subtle';
  noPadding?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  actions,
  variant = 'default',
  noPadding = false,
  onClick,
}) => {
  // Whisper-quiet elevation: no dashed purple borders, no thick outlines
  const variantClasses = {
    default: 'bg-white border border-neutral-200/80',
    admin: 'bg-white border border-neutral-200/80',
    highlighted: 'bg-white border border-peri-300 ring-1 ring-peri-500/10',
    subtle: 'bg-surface-subtle/70 border border-neutral-200/60',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl transition-colors duration-150 ${variantClasses[variant]} ${
        noPadding ? '' : 'p-5'
      } ${onClick ? 'cursor-pointer hover:border-peri-400' : ''} ${className}`}
    >
      {(title || actions || subtitle) && (
        <div
          className={`flex flex-wrap justify-between items-center gap-3 ${
            noPadding ? 'px-5 pt-4 pb-3.5 border-b border-neutral-100' : 'mb-4 pb-3 border-b border-neutral-100'
          }`}
        >
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-ink-primary tracking-tight flex items-center gap-2">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-ink-tertiary mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
