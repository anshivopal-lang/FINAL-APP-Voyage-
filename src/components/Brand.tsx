/** The Voyager mark — a compass rose, drawn rather than iconographic. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="voyager-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ecd9ac" />
          <stop offset="55%" stopColor="#c9a961" />
          <stop offset="100%" stopColor="#8a6d31" />
        </linearGradient>
      </defs>

      <circle
        cx="20"
        cy="20"
        r="17.25"
        stroke="url(#voyager-gold)"
        strokeWidth="1.1"
        opacity="0.55"
      />
      <circle
        cx="20"
        cy="20"
        r="13"
        stroke="url(#voyager-gold)"
        strokeWidth="0.65"
        opacity="0.3"
      />

      {/* Cardinal star */}
      <path
        d="M20 4.5 22.4 17.6 35.5 20 22.4 22.4 20 35.5 17.6 22.4 4.5 20 17.6 17.6z"
        fill="url(#voyager-gold)"
      />
      {/* Ordinal star, recessed */}
      <path
        d="M20 9.5 21.3 18.7 30.5 20 21.3 21.3 20 30.5 18.7 21.3 9.5 20 18.7 18.7z"
        fill="#08090c"
        opacity="0.55"
        transform="rotate(45 20 20)"
      />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="display text-[1.35rem] leading-none tracking-[0.02em] text-ink-100">
        Voyager
      </span>
    </span>
  );
}
