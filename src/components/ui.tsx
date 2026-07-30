'use client';

import { useState, type ReactNode } from 'react';

import { CloseIcon, PlusIcon } from './Icons';
import { coverBackground } from '@/lib/covers';
import { cx, initials } from '@/lib/utils';

/* -- Avatar ------------------------------------------------------------- */

export function Avatar({
  name,
  color,
  size = 32,
  ring,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(160deg, ${color} 0%, rgba(0,0,0,0.45) 140%)`,
        fontSize: Math.round(size * 0.36),
      }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-white/95',
        ring && 'ring-2 ring-ink-900',
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  members,
  max = 4,
}: {
  members: Array<{ id: string; name: string; avatarColor: string }>;
  max?: number;
}) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((member) => (
          <Avatar
            key={member.id}
            name={member.name}
            color={member.avatarColor}
            size={28}
            ring
          />
        ))}
      </div>
      {rest > 0 ? (
        <span className="ml-2 text-xs text-ink-400">+{rest}</span>
      ) : null}
    </div>
  );
}

/* -- Cover -------------------------------------------------------------- */

export function Cover({
  cover,
  className,
  children,
}: {
  cover: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{ background: coverBackground(cover) }}
      className={cx('relative overflow-hidden bg-cover bg-center', className)}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" />
      {children}
    </div>
  );
}

/* -- Toggle ------------------------------------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        'flex items-start justify-between gap-4 py-3',
        disabled && 'opacity-55',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm text-ink-100">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-400">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition',
          checked
            ? 'border-gold-500/60 bg-gold-500/70'
            : 'border-white/12 bg-white/6',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full bg-white shadow transition-all',
            checked ? 'left-[1.5rem]' : 'left-[0.1875rem]',
          )}
          style={{ width: 18, height: 18 }}
        />
      </button>
    </label>
  );
}

/* -- Tag input ---------------------------------------------------------- */

export function TagInput({
  values,
  onChange,
  placeholder,
  disabled,
  id,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const value = draft.trim();
    if (!value) return;
    if (values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, value]);
    setDraft('');
  }

  return (
    <div
      className={cx(
        'rounded-xl border border-white/9 bg-ink-950/65 p-2',
        disabled && 'opacity-55',
      )}
    >
      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span key={value} className="chip">
              {value}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  onClick={() => onChange(values.filter((item) => item !== value))}
                  className="-mr-1 rounded-full p-0.5 text-ink-400 transition hover:text-rose-500"
                >
                  <CloseIcon width={12} height={12} />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Backspace' && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          className="min-w-0 flex-1 bg-transparent px-1.5 py-1 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={commit}
          disabled={disabled || !draft.trim()}
          className="btn btn-ghost px-2.5 py-1"
          aria-label="Add"
        >
          <PlusIcon width={15} height={15} />
        </button>
      </div>
    </div>
  );
}

/* -- Misc --------------------------------------------------------------- */

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="display text-lg text-ink-100">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-ink-500">{icon}</div> : null}
      <p className="text-sm font-medium text-ink-200">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="panel-flat px-4 py-3.5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-400">
        {label}
      </p>
      <p className="display mt-1.5 text-xl text-ink-100">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'gold' | 'sage' | 'rose' | 'sky';
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium',
        tone === 'neutral' && 'border-white/12 bg-white/5 text-ink-300',
        tone === 'gold' && 'border-gold-500/40 bg-gold-500/12 text-gold-300',
        tone === 'sage' && 'border-sage-500/40 bg-sage-500/12 text-[#a9d5ba]',
        tone === 'rose' && 'border-rose-500/40 bg-rose-500/12 text-[#e8a9ad]',
        tone === 'sky' && 'border-sky-500/40 bg-sky-500/12 text-[#a6c3e6]',
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}
