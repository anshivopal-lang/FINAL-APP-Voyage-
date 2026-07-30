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
      <Cover cover={holiday.coverImage} className="h-52 sm:h-64">
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-lg bg-ink-950/55 px-2.5 py-1.5 text-xs text-white/85 backdrop-blur transition hover:bg-ink-950/75"
          >
            <ChevronLeftIcon width={14} height={14} />
            All holidays
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDuplicate}
              title="Duplicate this holiday"
              className="rounded-lg bg-ink-950/55 p-2 text-white/85 backdrop-blur transition hover:bg-ink-950/75"
            >
              <CopyIcon width={15} height={15} />
            </button>
            {canArchive && holiday.status === 'active' ? (
              <button
                type="button"
                onClick={onArchive}
                title="Archive this holiday"
                className="rounded-lg bg-ink-950/55 p-2 text-white/85 backdrop-blur transition hover:bg-ink-950/75"
              >
                <ArchiveIcon width={15} height={15} />
              </button>
            ) : null}
            {canEdit ? (
              <Link
                href={`/holidays/${holiday.id}/settings`}
                title="Holiday settings"
                className="flex items-center gap-1.5 rounded-lg bg-ink-950/55 px-2.5 py-2 text-xs text-white/85 backdrop-blur transition hover:bg-ink-950/75"
              >
                <SettingsIcon width={15} height={15} />
                Settings
              </Link>
            ) : null}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
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

          <h1 className="display mt-2.5 text-2xl text-white sm:text-4xl">
            {holiday.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75">
            <span className="flex items-center gap-1.5">
              <CalendarIcon width={14} height={14} />
              {formatDateRange(holiday.startDate, holiday.endDate)}
            </span>
            {nights > 0 ? (
              <span className="flex items-center gap-1.5">
                <PlaneIcon width={14} height={14} />
                {nights} night{nights === 1 ? '' : 's'}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <WalletIcon width={14} height={14} />
              {holiday.primaryCurrency}
              {holiday.secondaryCurrencies.length > 0
                ? ` +${holiday.secondaryCurrencies.join(', ')}`
                : ''}
            </span>
          </div>
        </div>
      </Cover>

      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {holiday.cities.length > 0 ? (
            <span className="flex items-center gap-1.5 text-sm text-ink-300">
              <MapPinIcon width={14} height={14} className="text-ink-500" />
              {holiday.cities.join(' · ')}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <AvatarStack members={holiday.members} max={5} />
          <span className="text-xs text-ink-500">
            {holiday.members.length} member
            {holiday.members.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {holiday.description ? (
        <p className="border-t border-white/6 px-5 py-4 text-sm leading-relaxed text-ink-300 sm:px-6">
          {holiday.description}
        </p>
      ) : null}
    </div>
  );
}
