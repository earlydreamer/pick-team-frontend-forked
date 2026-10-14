import React, { ReactNode } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'admin' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * 10. 버튼 & 폼 요소 스펙 반영:
 * - Primary: #6667AB bg, white bold text, peri-glow shadow
 * - Secondary: #EEF2FF bg, #4F46E5 bold text, border #C7D2FE
 * - Ghost / Outline: white bg, #334155 bold text, border #CBD5E1
 * - Danger: #EF4444 bg or soft #FEE2E2 bg
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-xl press-scale cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peri-500 focus-visible:ring-offset-1 disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none';

  const sizeStyles = {
    xs: 'h-8 px-3 text-xs gap-1.5',
    sm: 'h-9 px-3.5 text-sm gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-peri-500 text-white hover:bg-peri-600 shadow-peri-glow',
    admin: 'bg-peri-600 text-white hover:bg-peri-700 shadow-peri-glow',
    secondary: 'bg-peri-50 text-peri-600 hover:bg-peri-100 border border-peri-200',
    outline: 'bg-white text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary border border-neutral-300',
    ghost: 'bg-transparent text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary',
    danger: 'bg-[#EF4444] text-white hover:bg-[#DC2626] shadow-sm',
    warning: 'bg-[#F59E0B] text-white hover:bg-[#D97706] shadow-sm',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 text-current shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
