import React, { ReactNode, useEffect } from 'react';
import { XMarkIcon } from '@/assets/icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-ink-primary/40 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white rounded-t-xl sm:rounded-xl shadow-craft-lg border border-neutral-200 w-full ${sizeClasses[size]} max-h-[88vh] flex flex-col overflow-hidden`}
      >
        <div className="flex justify-between items-start gap-4 px-5 py-4 border-b border-neutral-100 shrink-0">
          <div>
            <h3 id="modal-title" className="text-base font-semibold text-ink-primary">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-ink-tertiary mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-7 h-7 rounded-md flex items-center justify-center text-ink-tertiary hover:text-ink-primary hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 text-sm text-ink-secondary overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex justify-end items-center gap-2 px-5 py-3 bg-surface-subtle/40 border-t border-neutral-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
