'use client';

import Link from 'next/link';

import { CalendarIcon, CopyIcon, MapPinIcon, SettingsIcon } from './Icons';
import { AvatarStack, Badge, Cover } from './ui';
import type { Holiday } from '@/lib/types';
import {
  daysUntil,
  formatDateRange,
  holidayPhase,
  nightsBetween,
} from '@/lib/utils';

function phaseBadge(holiday: Holiday) {
  if (holiday.status === 'archived') {
    return <Badge tone="neutral">Archived</Badge>;
  }

  const phase = holidayPhase(holiday);
  if (phase === 'in-progress') return <Badge tone="sage">In progress</Badge>;
  if (phase === 'past') return <Badge tone="sky">Completed</Badge>;

  const days = daysUntil(holiday.startDate);
  if (days === null || !holiday.startDate) {
    return <Badge tone="gold">Planning</Badge>;
  }
  return <Badge tone="gold">{days} days away</Badge>;
}

export function HolidayCard({
  holiday,
  onDuplicate,
  canManage,
}: {
  holiday: Holiday;
  onDuplicate?: (id: string) => void;
  canManage?: boolean;
}) {
  const nights = nightsBetween(holiday.startDate, holiday.endDate);

  return (
    <article className="panel lift group overflow-hidden">
      <Link href={`/holidays/${holiday.id}`} className="block">
        <Cover cover={holiday.coverImage} zoom className="h-44">
          <div className="absolute inset-x-0 top-0 flex justify-end p-3.5">
            {phaseBadge(holiday)}
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="display truncate text-[1.375rem] text-white">
              {holiday.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-white/65">
              <MapPinIcon width={12} height={12} />
              {holiday.cities.length > 0
                ? `${holiday.cities.slice(0, 3).join(' · ')}${
                    holiday.cities.length > 3
                      ? ` +${holiday.cities.length - 3}`
                      : ''
                  }`
                : holiday.country}
            </p>
          </div>
        </Cover>
      </Link>

      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3 text-xs text-ink-400">
          <span className="flex min-w-0 items-center gap-1.5">
            <CalendarIcon width={12} height={12} className="shrink-0 text-ink-500" />
            <span className="truncate">
              {formatDateRange(holiday.startDate, holiday.endDate)}
            </span>
          </span>
          {nights > 0 ? (
            <span className="shrink-0 text-ink-500">
              {nights} night{nights === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-white/6 pt-3.5">
          <AvatarStack members={holiday.members} />

          <div className="flex items-center gap-0.5 opacity-60 transition-opacity duration-300 group-hover:opacity-100">
            {onDuplicate ? (
              <button
                type="button"
                title="Duplicate this holiday"
                aria-label={`Duplicate ${holiday.name}`}
                onClick={() => onDuplicate(holiday.id)}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/7 hover:text-gold-300"
              >
                <CopyIcon width={15} height={15} />
              </button>
            ) : null}
            {canManage ? (
              <Link
                href={`/holidays/${holiday.id}/settings`}
                title="Holiday settings"
                aria-label={`Settings for ${holiday.name}`}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/7 hover:text-gold-300"
              >
                <SettingsIcon width={15} height={15} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
