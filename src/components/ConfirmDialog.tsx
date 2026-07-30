'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { AlertIcon } from './Icons';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** Rendered above the confirmation control — use for consequence lists. */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  /**
   * When set, the confirm button stays disabled until the user types this
   * text exactly. Used for permanent deletion.
   */
  requirePhrase?: string;
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  requirePhrase,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const confirmed = !requirePhrase || typed.trim() === requirePhrase;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!confirmed}
            className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {tone === 'danger' ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-500/35 bg-rose-500/8 px-3.5 py-3">
          <span className="mt-0.5 shrink-0 text-rose-500">
            <AlertIcon width={17} height={17} />
          </span>
          <p className="text-sm leading-relaxed text-[#e8b9bc]">
            This action cannot be undone.
          </p>
        </div>
      ) : null}

      {body}

      {requirePhrase ? (
        <div className="mt-4">
          <label className="label" htmlFor="confirm-phrase">
            Type <span className="text-gold-300">{requirePhrase}</span> to confirm
          </label>
          <input
            id="confirm-phrase"
            type="text"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={requirePhrase}
            className="field"
          />
        </div>
      ) : null}
    </Modal>
  );
}
