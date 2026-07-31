'use client';

import { useEffect, type ReactNode } from 'react';

import { CloseIcon } from './Icons';
import { cx } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-ink-950/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'panel animate-rise relative my-auto w-full',
          size === 'sm' && 'max-w-md',
          size === 'md' && 'max-w-2xl',
          size === 'lg' && 'max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/7 px-5 py-5 sm:px-7">
          <div>
            <h2 className="display text-xl text-ink-100 sm:text-2xl">{title}</h2>
            {description ? (
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 transition hover:bg-white/6 hover:text-ink-100"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 py-6 sm:px-7">{children}</div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-white/7 px-5 py-4 sm:px-7">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
