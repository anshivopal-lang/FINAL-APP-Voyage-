'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ArchiveIcon,
  CalendarIcon,
  FileIcon,
  ImageIcon,
  LockIcon,
  MapPinIcon,
  RestoreIcon,
  SearchIcon,
  WalletIcon,
} from '@/components/Icons';
import { useToast } from '@/components/Toast';
import {
  Avatar,
  AvatarStack,
  Badge,
  Cover,
  EmptyState,
  Field,
  StatTile,
} from '@/components/ui';
import { convert, formatMoney } from '@/lib/currency';
import { canAccess } from '@/lib/permissions';
import { useStore } from '@/lib/store';
import type { Holiday } from '@/lib/types';
import {
  cx,
  formatDate,
  formatDateRange,
  formatTimestamp,
  matchesQuery,
  nightsBetween,
} from '@/lib/utils';

export default function ArchivePage() {
  const store = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('all');
  const [year, setYear] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const archived = useMemo(
    () =>
      store.holidays
        .filter(
          (holiday) =>
            holiday.status === 'archived' &&
            canAccess(holiday, store.currentUserId),
        )
        .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || '')),
    [store.holidays, store.currentUserId],
  );

  const countries = useMemo(
    () => [...new Set(archived.map((holiday) => holiday.country))].sort(),
    [archived],
  );

  const years = useMemo(
    () =>
      [
        ...new Set(
          archived
            .map((holiday) => holiday.endDate.slice(0, 4))
            .filter(Boolean),
        ),
      ].sort((a, b) => b.localeCompare(a)),
    [archived],
  );

  const results = useMemo(
    () =>
      archived.filter((holiday) => {
        if (country !== 'all' && holiday.country !== country) return false;
        if (year !== 'all' && !holiday.endDate.startsWith(year)) return false;

        // Search reaches into the trip's contents, not just its title, so old
        // expenses, documents and photos stay findable.
        return matchesQuery(
          [
            holiday.name,
            holiday.country,
            holiday.description,
            ...holiday.cities,
            ...holiday.expenses.map((expense) => expense.title),
            ...holiday.documents.map((doc) => doc.name),
            ...holiday.photos.map((photo) => photo.caption),
            ...holiday.itinerary.map((item) => item.title),
          ],
          query,
        );
      }),
    [archived, country, year, query],
  );

  const totalNights = archived.reduce(
    (sum, holiday) => sum + nightsBetween(holiday.startDate, holiday.endDate),
    0,
  );
  const totalPhotos = archived.reduce(
    (sum, holiday) => sum + holiday.photos.length,
    0,
  );

  const restoringHoliday = archived.find((holiday) => holiday.id === restoring);

  if (!store.ready) {
    return <div className="py-32 text-center text-sm text-ink-500">Loading…</div>;
  }

  return (
    <div className="animate-rise">
      <div className="mb-10">
        <p className="eyebrow">Travel history</p>
        <h1 className="display-xl mt-3 text-ink-100">Archived trips</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-400">
          Everything you have finished, kept exactly as it was. Archived
          holidays stay private and are visible only to the people who travelled
          with you.
        </p>
      </div>

      {archived.length > 0 ? (
        <div className="mb-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Trips" value={String(archived.length)} />
          <StatTile label="Countries" value={String(countries.length)} />
          <StatTile label="Nights away" value={String(totalNights)} />
          <StatTile label="Photos kept" value={String(totalPhotos)} />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500">
            <SearchIcon width={15} height={15} />
          </span>
          <input
            className="field pl-9"
            aria-label="Search archived holidays"
            placeholder="Search trips, expenses, documents, photos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <select
          className="field w-auto"
          aria-label="Filter by country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        >
          <option value="all">All countries</option>
          {countries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          className="field w-auto"
          aria-label="Filter by year"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        >
          <option value="all">All years</option>
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {archived.length === 0 ? (
        <EmptyState
          icon={<ArchiveIcon width={28} height={28} />}
          title="Nothing archived yet"
          description="When a trip is over, archive it from its settings. It keeps every expense, document and photo without cluttering your dashboard."
          action={
            <Link href="/" className="btn btn-ghost">
              Back to dashboard
            </Link>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SearchIcon width={26} height={26} />}
          title="No archived trip matches"
          description="Try a different search, or clear the country and year filters."
        />
      ) : (
        <div className="space-y-4">
          {results.map((holiday) => (
            <ArchivedHolidayRow
              key={holiday.id}
              holiday={holiday}
              expanded={openId === holiday.id}
              canRestore={store.can(holiday.id, 'holiday.archive')}
              onToggle={() =>
                setOpenId((current) =>
                  current === holiday.id ? null : holiday.id,
                )
              }
              onRestore={() => setRestoring(holiday.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(restoring)}
        onCancel={() => setRestoring(null)}
        onConfirm={() => {
          if (!restoringHoliday) return;
          toast.fromResult(
            store.restoreHoliday(restoringHoliday.id),
            `${restoringHoliday.name} is back on your dashboard.`,
          );
          setRestoring(null);
        }}
        tone="neutral"
        title={`Restore “${restoringHoliday?.name ?? ''}”?`}
        description="The holiday returns to your active list with everything intact."
        confirmLabel="Restore holiday"
      />
    </div>
  );
}

function ArchivedHolidayRow({
  holiday,
  expanded,
  canRestore,
  onToggle,
  onRestore,
}: {
  holiday: Holiday;
  expanded: boolean;
  canRestore: boolean;
  onToggle: () => void;
  onRestore: () => void;
}) {
  const spent = holiday.expenses.reduce(
    (sum, expense) =>
      sum + convert(expense.amount, expense.currency, holiday.primaryCurrency),
    0,
  );

  return (
    <article className="panel group overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row">
        <Cover
          cover={holiday.coverImage}
          zoom
          className="h-32 shrink-0 sm:h-auto sm:w-56"
        />

        <div className="min-w-0 flex-1 px-5 py-5 sm:pl-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="display truncate text-xl text-ink-100">
                {holiday.name}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                <span className="flex items-center gap-1.5">
                  <MapPinIcon width={13} height={13} />
                  {holiday.country}
                  {holiday.cities.length > 0
                    ? ` · ${holiday.cities.join(', ')}`
                    : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarIcon width={13} height={13} />
                  {formatDateRange(holiday.startDate, holiday.endDate)}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                Archived {formatDate((holiday.archivedAt ?? '').slice(0, 10))}
              </Badge>
              {!holiday.restoreEnabled ? (
                <Badge tone="rose">
                  <LockIcon width={11} height={11} />
                  Restore off
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-400">
            <span className="flex items-center gap-1.5">
              <WalletIcon width={13} height={13} />
              {formatMoney(spent, holiday.primaryCurrency)} spent
            </span>
            <span className="flex items-center gap-1.5">
              <ImageIcon width={13} height={13} />
              {holiday.photos.length} photo
              {holiday.photos.length === 1 ? '' : 's'}
            </span>
            <span className="flex items-center gap-1.5">
              <FileIcon width={13} height={13} />
              {holiday.documents.length} document
              {holiday.documents.length === 1 ? '' : 's'}
            </span>
            <AvatarStack members={holiday.members} max={4} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={onToggle}>
              {expanded ? 'Hide details' : 'View trip record'}
            </button>
            <Link href={`/holidays/${holiday.id}`} className="btn btn-ghost">
              Open holiday
            </Link>
            {canRestore ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!holiday.restoreEnabled}
                title={
                  holiday.restoreEnabled
                    ? 'Restore to your active holidays'
                    : 'Restore is disabled for this holiday'
                }
                onClick={onRestore}
              >
                <RestoreIcon width={15} height={15} />
                Restore
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="animate-rise grid gap-5 border-t border-white/7 px-5 py-5 lg:grid-cols-3">
          <ArchiveColumn
            title="Expenses"
            empty="No expenses recorded."
            count={holiday.expenses.length}
          >
            {holiday.expenses.slice(0, 8).map((expense) => {
              const payer = holiday.members.find(
                (member) => member.id === expense.paidByMemberId,
              );
              return (
                <li
                  key={expense.id}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ink-200">
                      {expense.title}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-500">
                      {formatDate(expense.date)}
                      {payer ? ` · ${payer.name}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-ink-300">
                    {formatMoney(expense.amount, expense.currency)}
                  </span>
                </li>
              );
            })}
          </ArchiveColumn>

          <ArchiveColumn
            title="Documents"
            empty="No documents kept."
            count={holiday.documents.length}
          >
            {holiday.documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 py-1.5">
                <FileIcon width={14} height={14} className="shrink-0 text-ink-500" />
                <span className="min-w-0 flex-1 truncate text-ink-200">
                  {doc.name}
                </span>
                {doc.confidential ? (
                  <LockIcon width={12} height={12} className="shrink-0 text-gold-500" />
                ) : null}
              </li>
            ))}
          </ArchiveColumn>

          <ArchiveColumn
            title="Photos"
            empty="No photos in the album."
            count={holiday.photos.length}
          >
            <li>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {holiday.photos.map((photo) => (
                  <figure
                    key={photo.id}
                    className="overflow-hidden rounded-lg border border-white/8"
                    title={photo.caption}
                  >
                    <div
                      style={{ background: photo.gradient }}
                      className="aspect-square w-full"
                    />
                  </figure>
                ))}
              </div>
            </li>
          </ArchiveColumn>

          <div className="lg:col-span-3">
            <p className="eyebrow-muted mb-3">Who travelled</p>
            <div className="flex flex-wrap gap-3">
              {holiday.members.map((member) => (
                <span
                  key={member.id}
                  className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-1.5"
                >
                  <Avatar
                    name={member.name}
                    color={member.avatarColor}
                    size={22}
                  />
                  <span className="text-xs text-ink-300">{member.name}</span>
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-500">
              Last updated {formatTimestamp(holiday.updatedAt)}. This record is
              visible only to these members.
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ArchiveColumn({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow-muted mb-2.5 flex items-center justify-between">
        {title}
        <span className="font-normal normal-case tracking-normal text-ink-500">
          {count}
        </span>
      </p>
      {count === 0 ? (
        <p className="text-xs text-ink-500">{empty}</p>
      ) : (
        <ul className={cx('divide-y divide-white/5 text-sm')}>{children}</ul>
      )}
    </div>
  );
}
