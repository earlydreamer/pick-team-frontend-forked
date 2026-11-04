import React, { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** 제목 아래 한 문장 설명. 파괴적 행동의 영향처럼 판단에 필요한 내용을 쓴다. */
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** 진행 중인 요청이 있을 때 Escape·닫기 버튼으로 닫히지 않게 한다. */
  preventClose?: boolean;
}

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
};

/** 열린 대화상자 순서. Escape·Tab은 가장 위의 대화상자만 처리한다. */
const openStack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 대화상자: 이름(제목)·포커스 이동과 복귀·Escape·Tab 순환을 지원한다.
 * 작은 화면에서는 아래에서 올라오는 시트 형태로 표시한다.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  preventClose = false,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const preventCloseRef = useRef(preventClose);
  preventCloseRef.current = preventClose;

  useEffect(() => {
    if (!isOpen) return;
    const token = Symbol('modal');
    openStack.push(token);
    const isTop = () => openStack[openStack.length - 1] === token;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // 첫 입력 요소(없으면 패널)로 포커스를 옮긴다. 닫기 버튼보다 내용의 입력을 우선한다.
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    const firstField = focusables.find((el) => el.dataset.modalClose === undefined);
    (firstField ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === 'Escape') {
        if (preventCloseRef.current) return;
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(token), 1);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-neutral-900/50 p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-modal border border-outline-soft bg-surface text-ink shadow-float focus:outline-none sm:max-h-[88vh] sm:rounded-modal ${sizeClasses[size]}`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold leading-7 sm:text-xl">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-5 text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={preventClose}
            data-modal-close=""
            aria-label="닫기"
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-container hover:text-ink disabled:opacity-40"
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-[0.9375rem] leading-6 text-ink sm:px-6 sm:pb-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-outline-soft px-5 py-4 sm:px-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};
