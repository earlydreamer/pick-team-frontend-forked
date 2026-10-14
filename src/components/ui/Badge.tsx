import React, { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'peri' | 'secondary' | 'accent' | 'neutral' | 'success' | 'warning' | 'danger' | 'admin' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'peri',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  // 08. 컬러 시스템 & 10. 태그 스펙 반영
  const variantClasses = {
    peri: 'bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]',
    secondary: 'bg-[#F3E8FF] text-[#7C3AED] border border-[#DDD6FE]',
    accent: 'bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]',
    admin: 'bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]',
    neutral: 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]',
    outline: 'bg-white text-[#334155] border border-[#CBD5E1]',
    success: 'bg-[#DCFCE7] text-[#059669] border border-[#A7F3D0]',
    warning: 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]',
    danger: 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]',
  };

  const dotColors = {
    peri: 'bg-[#6667AB]',
    secondary: 'bg-[#A78BFA]',
    accent: 'bg-[#38BDF8]',
    admin: 'bg-[#4F46E5]',
    neutral: 'bg-[#64748B]',
    outline: 'bg-[#64748B]',
    success: 'bg-[#10B981]',
    warning: 'bg-[#F59E0B]',
    danger: 'bg-[#EF4444]',
  };

  const sizeClasses = {
    xs: 'px-2.5 py-0.5 text-xs rounded-lg font-bold',
    sm: 'px-3 py-1 text-xs rounded-lg font-bold',
    md: 'px-3.5 py-1.5 text-sm rounded-xl font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap leading-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {dot && <span className={`w-2 h-2 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};
