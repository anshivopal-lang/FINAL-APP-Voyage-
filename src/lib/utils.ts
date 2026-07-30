import type { Holiday } from './types';

let idCounter = 0;

/** Collision-resistant enough for a client-side store, stable across renders. */
export function createId(prefix: string): string {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${random}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DATE_FORMAT_LONG = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMAT.format(date);
}

export function formatDateLong(iso: string): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMAT_LONG.format(date);
}

export function formatDateRange(start: string, end: string): string {
  if (!start && !end) return 'Dates to be confirmed';
  if (!end) return formatDate(start);
  return `${formatDate(start)} — ${formatDate(end)}`;
}

export function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function nightsBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const from = new Date(`${start}T00:00:00`).getTime();
  const to = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86_400_000);
}

export type HolidayPhase = 'upcoming' | 'in-progress' | 'past';

export function holidayPhase(holiday: Holiday): HolidayPhase {
  const startsIn = daysUntil(holiday.startDate);
  const endsIn = daysUntil(holiday.endDate);
  if (startsIn !== null && startsIn > 0) return 'upcoming';
  if (endsIn !== null && endsIn < 0) return 'past';
  return 'in-progress';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Case- and accent-insensitive haystack search used by the archive. */
export function matchesQuery(haystack: string[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((value) => value.toLowerCase().includes(needle));
}
