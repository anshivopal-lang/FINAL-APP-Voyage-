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
    <article className="panel group overflow-hidden transition hover:border-white/12">
      <Link href={`/holidays/${holiday.id}`} className="block">
        <Cover cover={holiday.coverImage} className="h-36 sm:h-40">
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <h3 className="display truncate text-lg text-white">
                {holiday.name}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-white/70">
                <MapPinIcon width={13} height={13} />
                {holiday.cities.length > 0
                  ? `${holiday.cities.slice(0, 3).join(' · ')}${
                      holiday.cities.length > 3
                        ? ` +${holiday.cities.length - 3}`
                        : ''
                    }`
                  : holiday.country}
              </p>
            </div>
            {phaseBadge(holiday)}
          </div>
        </Cover>
      </Link>

      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3 text-xs text-ink-400">
          <span className="flex min-w-0 items-center gap-1.5">
            <CalendarIcon width={13} height={13} />
            <span className="truncate">
              {formatDateRange(holiday.startDate, holiday.endDate)}
            </span>
          </span>
          {nights > 0 ? (
            <span className="shrink-0">
              {nights} night{nights === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3">
          <AvatarStack members={holiday.members} />

          <div className="flex items-center gap-1">
            {onDuplicate ? (
              <button
                type="button"
                title="Duplicate this holiday"
                aria-label={`Duplicate ${holiday.name}`}
                onClick={() => onDuplicate(holiday.id)}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/6 hover:text-ink-100"
              >
                <CopyIcon width={15} height={15} />
              </button>
            ) : null}
            {canManage ? (
              <Link
                href={`/holidays/${holiday.id}/settings`}
                title="Holiday settings"
                aria-label={`Settings for ${holiday.name}`}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/6 hover:text-ink-100"
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
