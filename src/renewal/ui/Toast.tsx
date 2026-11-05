import React, { useSyncExternalStore } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * 토스트 알림. alert() 대신 사용한다(00 §5-7).
 * 성공·안내는 role=status, 실패는 role=alert로 읽히며 실패 토스트는 사용자가 닫을 때까지 남는다.
 * 안내(info)는 내 행동의 결과가 아닌 상황 설명(예: 삭제된 항목으로 들어옴)에 쓴다.
 */

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const dismiss = (id: number) => {
  items = items.filter((item) => item.id !== id);
  emit();
};

const push = (tone: Tone, message: string) => {
  const id = nextId++;
  items = [...items, { id, tone, message }].slice(-3);
  emit();
  if (tone !== 'error') setTimeout(() => dismiss(id), tone === 'info' ? 6000 : 4000);
};

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const Toaster: React.FC = () => {
  const current = useSyncExternalStore(subscribe, () => items);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[150] flex flex-col items-center gap-2 px-4">
      {current.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-card border px-4 py-3 text-sm shadow-float ${
            item.tone === 'error' ? 'border-red-200 bg-red-50 text-danger' : 'border-outline-soft bg-surface text-ink'
          }`}
        >
          {item.tone === 'error' ? (
            <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          ) : item.tone === 'info' ? (
            <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          )}
          <p className="flex-1 leading-5">{item.message}</p>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="알림 닫기"
            className="-m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-surface-container"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
