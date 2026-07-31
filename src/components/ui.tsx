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
  image,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
  /** Google profile picture, when the member has signed in. */
  image?: string | null;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        title={name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        className={cx(
          'inline-block shrink-0 rounded-full object-cover',
          ring && 'ring-2 ring-ink-950',
        )}
      />
    );
  }

  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(155deg, ${color} 0%, rgba(0,0,0,0.55) 145%)`,
        fontSize: Math.round(size * 0.34),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
      }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium tracking-wide text-white/95',
        ring && 'ring-2 ring-ink-950',
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
      <div className="flex -space-x-2.5">
        {shown.map((member) => (
          <Avatar
            key={member.id}
            name={member.name}
            color={member.avatarColor}
            size={26}
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
  zoom,
  children,
}: {
  cover: string;
  className?: string;
  /** Scales the art gently when an ancestor `.group` is hovered. */
  zoom?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cx('relative overflow-hidden', className)}>
      <div
        style={{ background: coverBackground(cover) }}
        className={cx('absolute inset-0 bg-cover bg-center', zoom && 'cover-zoom')}
      />
      {/* The scrim only needs to be heavy where text sits on top of the art. */}
      <div
        className={cx(
          'absolute inset-0',
          children
            ? 'bg-gradient-to-t from-ink-950 via-ink-950/25 to-transparent'
            : 'bg-gradient-to-t from-ink-950/45 to-transparent',
        )}
      />
      <div
        className={cx(
          'absolute inset-0',
          children
            ? 'shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]'
            : 'shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]',
        )}
      />
      {children ? <div className="relative h-full">{children}</div> : null}
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
        'flex items-start justify-between gap-5 py-3.5',
        disabled && 'opacity-55',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm text-ink-100">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-relaxed text-ink-400">
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
        style={
          checked
            ? {
                background:
                  'linear-gradient(180deg, #dcc084 0%, #c9a961 60%, #ab8845 100%)',
              }
            : undefined
        }
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked
            ? 'border-gold-600/70 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset]'
            : 'border-white/10 bg-white/6 shadow-[0_1px_2px_rgba(0,0,0,0.3)_inset]',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <span
          style={{ width: 18, height: 18 }}
          className={cx(
            'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-all duration-200 ease-out',
            checked ? 'left-[1.4375rem]' : 'left-[0.1875rem]',
          )}
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
        'panel-inset p-2',
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

/* -- Structure ---------------------------------------------------------- */

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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="display text-xl text-ink-100">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
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
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/3 text-ink-500">
          {icon}
        </div>
      ) : null}
      <p className="display text-lg text-ink-200">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
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
    <div className="panel-flat group relative overflow-hidden px-4 py-4 transition-colors duration-300 hover:border-white/12">
      {/* Gold accent bar, revealed on hover. */}
      <span className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-gold-500/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <p className="eyebrow-muted">{label}</p>
      <p className="numeral mt-2 text-[1.75rem] leading-none text-ink-100">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 truncate text-xs text-ink-500">{hint}</p>
      ) : null}
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
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium tracking-wide backdrop-blur-sm',
        tone === 'neutral' && 'border-white/12 bg-white/6 text-ink-300',
        tone === 'gold' && 'border-gold-500/35 bg-gold-500/12 text-gold-300',
        tone === 'sage' && 'border-sage-500/35 bg-sage-500/12 text-[#a9d5ba]',
        tone === 'rose' && 'border-rose-500/35 bg-rose-500/12 text-[#e8a9ad]',
        tone === 'sky' && 'border-sky-500/35 bg-sky-500/12 text-[#a6c3e6]',
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
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
