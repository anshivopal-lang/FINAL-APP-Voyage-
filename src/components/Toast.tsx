'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AlertIcon, CheckIcon } from './Icons';
import { cx } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

type Result = { ok: boolean; error?: string };

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /**
   * Reports the outcome of a store mutation. Store calls hit the API, so this
   * takes a promise and resolves to whether it succeeded — `await` it when the
   * next step depends on the result.
   */
  fromResult: (
    result: Result | Promise<Result>,
    success: string,
  ) => Promise<boolean>;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    nextId += 1;
    const id = nextId;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
      fromResult: async (result, success) => {
        const settled = await result;
        if (settled.ok) {
          push('success', success);
          return true;
        }
        push('error', settled.error ?? 'Something went wrong.');
        return false;
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cx(
              'animate-rise pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-2xl backdrop-blur',
              toast.tone === 'success' &&
                'border-sage-500/40 bg-sage-500/12 text-[#bfe3cc]',
              toast.tone === 'error' &&
                'border-rose-500/45 bg-rose-500/12 text-[#f0b4b8]',
              toast.tone === 'info' &&
                'border-white/12 bg-ink-800/90 text-ink-100',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {toast.tone === 'error' ? (
                <AlertIcon width={16} height={16} />
              ) : (
                <CheckIcon width={16} height={16} />
              )}
            </span>
            <span className="leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}
