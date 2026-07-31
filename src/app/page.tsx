'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CreateHolidayDialog } from '@/components/CreateHolidayDialog';
import { HolidayCard } from '@/components/HolidayCard';
import {
  ArchiveIcon,
  CompassIcon,
  PlaneIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { EmptyState, SectionTitle, StatTile } from '@/components/ui';
import { canAccess } from '@/lib/permissions';
import { useStore } from '@/lib/store';
import type { Holiday } from '@/lib/types';
import {
  daysUntil,
  holidayPhase,
  matchesQuery,
  nightsBetween,
} from '@/lib/utils';

export default function DashboardPage() {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      store.holidays.filter((holiday) =>
        canAccess(holiday, store.currentMemberId),
      ),
    [store.holidays, store.currentMemberId],
  );

  const active = useMemo(
    () => visible.filter((holiday) => holiday.status === 'active'),
    [visible],
  );

  const filtered = useMemo(
    () =>
      active.filter((holiday) =>
        matchesQuery(
          [holiday.name, holiday.country, ...holiday.cities],
          query,
        ),
      ),
    [active, query],
  );

  const upcoming = filtered
    .filter((holiday) => holidayPhase(holiday) !== 'past')
    .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));

  const past = filtered
    .filter((holiday) => holidayPhase(holiday) === 'past')
    .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));

  const archivedCount = visible.filter(
    (holiday) => holiday.status === 'archived',
  ).length;

  const nextTrip = upcoming.find((holiday) => holidayPhase(holiday) !== 'past');
  const nightsPlanned = active.reduce(
    (total, holiday) => total + nightsBetween(holiday.startDate, holiday.endDate),
    0,
  );
  const countries = new Set(visible.map((holiday) => holiday.country)).size;

  function duplicate(id: string) {
    const { result, id: newId } = store.duplicateHoliday(id);
    if (!toast.fromResult(result, 'Holiday duplicated — dates cleared, ready to re-plan.')) {
      return;
    }
    if (newId) router.push(`/holidays/${newId}`);
  }

  if (!store.ready) {
    return <LoadingState />;
  }

  return (
    <div className="animate-rise">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 className="display-xl mt-3 text-ink-100">
            {store.currentMemberName.split(' ')[0]}’s holidays
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-400">
            Every trip you own or have been invited to. Create as many as you
            like — nothing here is ever shared outside your members.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating(true)}
        >
          <PlusIcon width={16} height={16} />
          New holiday
        </button>
      </div>

      <div className="mb-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Active"
          value={String(active.length)}
          hint="Planned or in progress"
        />
        <StatTile
          label="Next departure"
          value={
            nextTrip?.startDate
              ? `${Math.max(0, daysUntil(nextTrip.startDate) ?? 0)}d`
              : '—'
          }
          hint={nextTrip?.name ?? 'Nothing booked yet'}
        />
        <StatTile
          label="Nights planned"
          value={String(nightsPlanned)}
          hint="Across active holidays"
        />
        <StatTile
          label="Countries"
          value={String(countries)}
          hint="Including archived trips"
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500">
            <SearchIcon width={15} height={15} />
          </span>
          <input
            className="field pl-9"
            placeholder="Search holidays, countries, cities"
            value={query}
            aria-label="Search holidays"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <Link href="/archive" className="btn btn-ghost">
          <ArchiveIcon width={15} height={15} />
          Archive
          {archivedCount > 0 ? (
            <span className="chip chip-gold ml-0.5 px-1.5 py-0">
              {archivedCount}
            </span>
          ) : null}
        </Link>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={<CompassIcon width={28} height={28} />}
          title="No holidays yet"
          description="Create your first holiday and start collecting itineraries, bookings, expenses and photos in one place."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              <PlusIcon width={16} height={16} />
              Create a holiday
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SearchIcon width={26} height={26} />}
          title="Nothing matches that search"
          description={`No active holiday matches “${query}”. Try the archive for past trips.`}
        />
      ) : (
        <div className="space-y-12">
          {upcoming.length > 0 ? (
            <section>
              <SectionTitle
                title="Upcoming & in progress"
                subtitle={`${upcoming.length} holiday${upcoming.length === 1 ? '' : 's'}`}
              />
              <HolidayGrid
                holidays={upcoming}
                onDuplicate={duplicate}
                canManage={(holiday) =>
                  store.can(holiday.id, 'holiday.edit')
                }
              />
            </section>
          ) : null}

          {past.length > 0 ? (
            <section>
              <SectionTitle
                title="Completed"
                subtitle="Finished trips — archive them to keep the dashboard clear."
              />
              <HolidayGrid
                holidays={past}
                onDuplicate={duplicate}
                canManage={(holiday) =>
                  store.can(holiday.id, 'holiday.edit')
                }
              />
            </section>
          ) : null}
        </div>
      )}

      <CreateHolidayDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function HolidayGrid({
  holidays,
  onDuplicate,
  canManage,
}: {
  holidays: Holiday[];
  onDuplicate: (id: string) => void;
  canManage: (holiday: Holiday) => boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {holidays.map((holiday) => (
        <HolidayCard
          key={holiday.id}
          holiday={holiday}
          onDuplicate={onDuplicate}
          canManage={canManage(holiday)}
        />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-ink-500">
      <PlaneIcon width={26} height={26} />
      <p className="mt-3 text-sm">Loading your holidays…</p>
    </div>
  );
}
