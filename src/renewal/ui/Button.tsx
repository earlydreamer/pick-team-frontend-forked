import React, { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** 진행 중에는 버튼을 비활성화해 중복 실행을 막고 보조기술에 진행 상태를 알린다. */
  loading?: boolean;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-sm gap-1.5',
  md: 'min-h-touch px-4 py-2.5 text-sm gap-2',
  lg: 'min-h-[48px] px-6 py-3 text-base gap-2',
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-dark border border-transparent',
  secondary: 'bg-primary-container text-on-primary-container hover:bg-peri-200 border border-transparent',
  danger: 'bg-danger text-white hover:brightness-110 border border-transparent',
  ghost: 'bg-transparent text-primary hover:bg-surface-container border border-transparent',
  /** 삭제·내보내기처럼 파괴적이지만 화면의 주 행동은 아닌 버튼. 확인 대화상자의 실제 실행은 danger를 쓴다 */
  'danger-ghost': 'bg-transparent text-danger hover:bg-red-50 border border-transparent',
  outline: 'bg-surface text-ink border border-outline hover:bg-surface-container',
};

/** 버튼 위계: primary는 화면의 주요 행동 하나, 나머지는 secondary·outline·ghost로 구분한다. */
export const buttonClassName = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') =>
  `inline-flex items-center justify-center rounded-[10px] font-semibold leading-5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${sizeStyles[size]} ${variantStyles[variant]} ${extra}`.trim();

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  leftIcon,
  rightIcon,
  loading = false,
  disabled,
  ...props
}) => {
  return (
    <button
      className={buttonClassName(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      {children}
      {rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
    </button>
  );
};
