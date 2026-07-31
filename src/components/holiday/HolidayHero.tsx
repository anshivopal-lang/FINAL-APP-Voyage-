'use client';

import Link from 'next/link';

import {
  ArchiveIcon,
  CalendarIcon,
  ChevronLeftIcon,
  CopyIcon,
  MapPinIcon,
  PlaneIcon,
  SettingsIcon,
  WalletIcon,
} from '@/components/Icons';
import { AvatarStack, Badge, Cover } from '@/components/ui';
import type { Holiday } from '@/lib/types';
import {
  daysUntil,
  formatDateRange,
  holidayPhase,
  nightsBetween,
} from '@/lib/utils';

const CHROME =
  'flex items-center gap-1.5 rounded-lg border border-white/12 bg-ink-950/50 px-2.5 py-2 text-xs text-white/85 backdrop-blur-md transition hover:border-white/25 hover:bg-ink-950/70 hover:text-white';

export function HolidayHero({
  holiday,
  canEdit,
  canArchive,
  onDuplicate,
  onArchive,
}: {
  holiday: Holiday;
  canEdit: boolean;
  canArchive: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const phase = holidayPhase(holiday);
  const nights = nightsBetween(holiday.startDate, holiday.endDate);
  const countdown = daysUntil(holiday.startDate);

  return (
    <div className="panel overflow-hidden">
      <Cover cover={holiday.coverImage} className="h-60 sm:h-72">
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 sm:p-5">
          <Link href="/" className={CHROME}>
            <ChevronLeftIcon width={14} height={14} />
            All holidays
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDuplicate}
              title="Duplicate this holiday"
              aria-label="Duplicate this holiday"
              className={CHROME}
            >
              <CopyIcon width={15} height={15} />
            </button>
            {canArchive && holiday.status === 'active' ? (
              <button
                type="button"
                onClick={onArchive}
                title="Archive this holiday"
                aria-label="Archive this holiday"
                className={CHROME}
              >
                <ArchiveIcon width={15} height={15} />
              </button>
            ) : null}
            {canEdit ? (
              <Link
                href={`/holidays/${holiday.id}/settings`}
                title="Holiday settings"
                className={CHROME}
              >
                <SettingsIcon width={15} height={15} />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {holiday.status === 'archived' ? (
              <Badge tone="neutral">Archived</Badge>
            ) : phase === 'in-progress' ? (
              <Badge tone="sage">In progress</Badge>
            ) : phase === 'past' ? (
              <Badge tone="sky">Completed</Badge>
            ) : countdown !== null && holiday.startDate ? (
              <Badge tone="gold">{countdown} days to go</Badge>
            ) : (
              <Badge tone="gold">Planning</Badge>
            )}
            <Badge tone="neutral">{holiday.country}</Badge>
          </div>

          <h1 className="display-lg mt-3 text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
            {holiday.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
            <span className="flex items-center gap-2">
              <CalendarIcon width={14} height={14} className="text-gold-400/80" />
              {formatDateRange(holiday.startDate, holiday.endDate)}
            </span>
            {nights > 0 ? (
              <span className="flex items-center gap-2">
                <PlaneIcon width={14} height={14} className="text-gold-400/80" />
                {nights} night{nights === 1 ? '' : 's'}
              </span>
            ) : null}
            <span className="flex items-center gap-2">
              <WalletIcon width={14} height={14} className="text-gold-400/80" />
              {holiday.primaryCurrency}
              {holiday.secondaryCurrencies.length > 0
                ? ` +${holiday.secondaryCurrencies.join(', ')}`
                : ''}
            </span>
          </div>
        </div>
      </Cover>

      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        {holiday.cities.length > 0 ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-ink-300">
            <MapPinIcon width={14} height={14} className="shrink-0 text-ink-500" />
            <span className="truncate">{holiday.cities.join(' · ')}</span>
          </span>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          <AvatarStack members={holiday.members} max={5} />
          <span className="text-xs text-ink-500">
            {holiday.members.length} member
            {holiday.members.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {holiday.description ? (
        <div className="border-t border-white/6 px-5 py-5 sm:px-8">
          <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-ink-300">
            {holiday.description}
          </p>
        </div>
      ) : null}
    </div>
  );
}
