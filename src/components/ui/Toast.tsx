import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { XMarkIcon } from '@/assets/icons';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setTimeout(() => {
        dismissToast(id);
      }, 3600);
    },
    [dismissToast]
  );

  const badgeDot: Record<ToastVariant, string> = {
    info: 'bg-peri-500',
    success: 'bg-emerald-600',
    warning: 'bg-amber-500',
    error: 'bg-rose-600',
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-16 lg:bottom-5 right-4 sm:right-5 z-[120] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((t) => {
          const v = t.variant || 'info';
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto rounded-lg bg-white shadow-craft-lg border border-neutral-200 px-3.5 py-3 flex items-start gap-2.5"
            >
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${badgeDot[v]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-ink-primary leading-snug">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-ink-tertiary mt-0.5 leading-relaxed">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="닫기"
                className="text-ink-tertiary hover:text-ink-primary p-0.5 rounded cursor-pointer"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
      dismissToast: () => {},
    };
  }
  return ctx;
};
