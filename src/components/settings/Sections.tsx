'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DocumentsPanel } from '@/components/holiday/Panels';
import { AlertIcon, ArchiveIcon, RestoreIcon, TrashIcon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { Field, Toggle } from '@/components/ui';
import { CURRENCIES, currencyName } from '@/lib/currency';
import { DATA_SECTION_LABELS, useStore, type DataSection } from '@/lib/store';
import type { Holiday, NotificationSettings } from '@/lib/types';
import { cx, formatTimestamp } from '@/lib/utils';

/* -- Notifications ------------------------------------------------------ */

const NOTIFICATION_ROWS: Array<{
  key: keyof Omit<NotificationSettings, 'digest'>;
  label: string;
  description: string;
}> = [
  {
    key: 'itineraryChanges',
    label: 'Itinerary changes',
    description: 'When a plan is added, moved or removed.',
  },
  {
    key: 'newExpenses',
    label: 'New expenses',
    description: 'When someone logs spending against the holiday.',
  },
  {
    key: 'memberActivity',
    label: 'Member activity',
    description: 'Joins, removals and permission changes.',
  },
  {
    key: 'documentUploads',
    label: 'Document uploads',
    description: 'When a passport, visa or reservation is added.',
  },
  {
    key: 'chatMessages',
    label: 'Chat messages',
    description: 'Every message in the holiday group chat.',
  },
  {
    key: 'departureReminder',
    label: 'Departure reminder',
    description: 'A nudge in the week before you travel.',
  },
];

export function NotificationsSection({ holiday }: { holiday: Holiday }) {
  const { updateNotifications } = useStore();
  const toast = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="display mb-1.5 text-lg text-ink-100">Notifications</h3>
        <p className="text-sm text-ink-400">
          These settings are yours for this holiday. Other members choose their
          own.
        </p>
      </div>

      <div className="panel-flat divide-y divide-white/6 px-4">
        {NOTIFICATION_ROWS.map((row) => (
          <Toggle
            key={row.key}
            label={row.label}
            description={row.description}
            checked={holiday.notifications[row.key]}
            onChange={(next) =>
              toast.fromResult(
                updateNotifications(holiday.id, { [row.key]: next }),
                'Notification preferences saved.',
              )
            }
          />
        ))}
      </div>

      <Field
        label="Digest"
        htmlFor="digest"
        hint="Non-urgent updates are bundled at this cadence."
      >
        <select
          id="digest"
          className="field"
          value={holiday.notifications.digest}
          onChange={(event) =>
            toast.fromResult(
              updateNotifications(holiday.id, {
                digest: event.target.value as NotificationSettings['digest'],
              }),
              'Digest updated.',
            )
          }
        >
          <option value="instant">Send instantly</option>
          <option value="daily">Daily summary</option>
          <option value="weekly">Weekly summary</option>
          <option value="off">No digest</option>
        </select>
      </Field>
    </div>
  );
}

/* -- Currency ----------------------------------------------------------- */

export function CurrencySection({
  holiday,
  readOnly,
}: {
  holiday: Holiday;
  readOnly: boolean;
}) {
  const { updateCurrencies } = useStore();
  const toast = useToast();

  function setPrimary(code: string) {
    toast.fromResult(
      updateCurrencies(holiday.id, code, holiday.secondaryCurrencies),
      `Primary currency set to ${code}.`,
    );
  }

  function toggleSecondary(code: string) {
    const next = holiday.secondaryCurrencies.includes(code)
      ? holiday.secondaryCurrencies.filter((existing) => existing !== code)
      : [...holiday.secondaryCurrencies, code];

    toast.fromResult(
      updateCurrencies(holiday.id, holiday.primaryCurrency, next),
      'Currency settings saved.',
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="display mb-1.5 text-lg text-ink-100">Currency</h3>
        <p className="text-sm text-ink-400">
          Bookings and expenses can be entered in any currency the holiday
          tracks. Totals are shown in the primary currency.
        </p>
      </div>

      <Field label="Primary currency" htmlFor="primary-currency">
        <select
          id="primary-currency"
          className="field"
          disabled={readOnly}
          value={holiday.primaryCurrency}
          onChange={(event) => setPrimary(event.target.value)}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Secondary currencies"
        hint="Useful for multi-country trips, or when you settle up back home."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CURRENCIES.filter(
            (currency) => currency.code !== holiday.primaryCurrency,
          ).map((currency) => {
            const active = holiday.secondaryCurrencies.includes(currency.code);
            return (
              <button
                key={currency.code}
                type="button"
                disabled={readOnly}
                onClick={() => toggleSecondary(currency.code)}
                className={cx(
                  'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed',
                  active
                    ? 'border-gold-500/45 bg-gold-500/12 text-gold-300'
                    : 'border-white/8 bg-white/3 text-ink-300 hover:bg-white/6',
                )}
              >
                <span>{currency.code}</span>
                <span className="text-xs text-ink-500">{currency.symbol}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <p className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs leading-relaxed text-ink-400">
        Currently tracking{' '}
        <span className="text-ink-100">
          {holiday.primaryCurrency} ({currencyName(holiday.primaryCurrency)})
        </span>
        {holiday.secondaryCurrencies.length > 0
          ? ` alongside ${holiday.secondaryCurrencies.join(', ')}.`
          : ' only.'}{' '}
        Conversions use indicative rates for display, not settlement.
      </p>
    </div>
  );
}

/* -- Documents ---------------------------------------------------------- */

export function DocumentsSection({
  holiday,
  readOnly,
}: {
  holiday: Holiday;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="display mb-1.5 text-lg text-ink-100">Documents</h3>
        <p className="text-sm text-ink-400">
          Documents marked confidential are hidden from members without the
          document permission.
        </p>
      </div>
      <DocumentsPanel holiday={holiday} readOnly={readOnly} />
    </div>
  );
}

/* -- Archive ------------------------------------------------------------ */

export function ArchiveSection({ holiday }: { holiday: Holiday }) {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const canArchive = store.can(holiday.id, 'holiday.archive');
  const archived = holiday.status === 'archived';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="display mb-1.5 text-lg text-ink-100">Archive</h3>
        <p className="text-sm text-ink-400">
          Archiving is the safe alternative to deleting. Everything is kept and
          stays private to the holiday’s members.
        </p>
      </div>

      <div className="panel-flat p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-300">
            <ArchiveIcon width={18} height={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-100">
              {archived ? 'This holiday is archived' : 'Holiday is active'}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {archived
                ? `Archived ${formatTimestamp(holiday.archivedAt ?? '')}`
                : 'Move it to the archive once the trip is over.'}
            </p>
          </div>

          {archived ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!canArchive || !holiday.restoreEnabled}
              onClick={() =>
                toast.fromResult(
                  store.restoreHoliday(holiday.id),
                  'Holiday restored to your active list.',
                )
              }
            >
              <RestoreIcon width={15} height={15} />
              Restore holiday
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!canArchive}
              onClick={() => setConfirming(true)}
            >
              <ArchiveIcon width={15} height={15} />
              Archive holiday
            </button>
          )}
        </div>
      </div>

      <div className="panel-flat px-4">
        <Toggle
          label="Allow restoring from the archive"
          description="Turn this off to keep the trip permanently in the archive as travel history. The owner can turn it back on."
          checked={holiday.restoreEnabled}
          disabled={!canArchive}
          onChange={(next) =>
            toast.fromResult(
              store.setRestoreEnabled(holiday.id, next),
              next ? 'Restore enabled.' : 'Restore disabled.',
            )
          }
        />
      </div>

      {!canArchive ? (
        <p className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-ink-400">
          Only the holiday owner can archive or restore this holiday.
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          const ok = await toast.fromResult(
            store.archiveHoliday(holiday.id),
            'Holiday moved to the archive.',
          );
          if (ok) router.push('/archive');
        }}
        tone="neutral"
        title="Archive this holiday?"
        description="Nothing is deleted — the trip simply moves out of your active list."
        confirmLabel="Archive holiday"
        body={
          <ul className="space-y-1.5 text-sm text-ink-300">
            <li>· Expenses, photos and documents remain searchable in the archive.</li>
            <li>· Members keep their access.</li>
            <li>· Restore it whenever you like, while restore is enabled.</li>
          </ul>
        }
      />
    </div>
  );
}

/* -- Data & deletion ---------------------------------------------------- */

const ALL_SECTIONS: DataSection[] = [
  'itinerary',
  'bookings',
  'expenses',
  'documents',
  'chat',
  'photos',
];

export function DangerSection({ holiday }: { holiday: Holiday }) {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();

  const [selected, setSelected] = useState<DataSection[]>([]);
  const [purging, setPurging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = store.isOwner(holiday.id);

  const counts: Record<DataSection, number> = {
    itinerary: holiday.itinerary.length,
    bookings: holiday.bookings.length,
    expenses: holiday.expenses.length,
    documents: holiday.documents.length,
    chat: holiday.chat.length,
    photos: holiday.photos.length,
  };

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <h3 className="display text-lg text-ink-100">Data & deletion</h3>
        <p className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-ink-400">
          Only the holiday owner can erase holiday data or delete this holiday.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="display mb-1.5 text-lg text-ink-100">Data deletion</h3>
        <p className="mb-4 text-sm text-ink-400">
          Clear part of the holiday without deleting the trip itself. Useful
          before duplicating a template, or when a plan changes completely.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_SECTIONS.map((section) => {
            const active = selected.includes(section);
            return (
              <button
                key={section}
                type="button"
                onClick={() =>
                  setSelected((current) =>
                    current.includes(section)
                      ? current.filter((item) => item !== section)
                      : [...current, section],
                  )
                }
                className={cx(
                  'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition',
                  active
                    ? 'border-rose-500/45 bg-rose-500/10 text-[#e8b9bc]'
                    : 'border-white/8 bg-white/3 text-ink-300 hover:bg-white/6',
                )}
              >
                <span>{DATA_SECTION_LABELS[section]}</span>
                <span className="text-xs text-ink-500">{counts[section]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="btn btn-danger"
            disabled={selected.length === 0}
            onClick={() => setPurging(true)}
          >
            <TrashIcon width={15} height={15} />
            Erase selected data
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
        <h3 className="display mb-1.5 flex items-center gap-2 text-lg text-[#f0b4b8]">
          <AlertIcon width={17} height={17} />
          Delete this holiday
        </h3>
        <p className="mb-4 text-sm leading-relaxed text-ink-300">
          Permanent and immediate. Consider archiving instead — it keeps your
          travel history and can be undone.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              const ok = await toast.fromResult(
                store.archiveHoliday(holiday.id),
                'Holiday archived instead. Nothing was deleted.',
              );
              if (ok) router.push('/archive');
            }}
            disabled={holiday.status === 'archived'}
          >
            <ArchiveIcon width={15} height={15} />
            Archive instead
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setDeleting(true)}
          >
            <TrashIcon width={15} height={15} />
            Delete permanently
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={purging}
        onCancel={() => setPurging(false)}
        onConfirm={async () => {
          setPurging(false);
          const ok = await toast.fromResult(
            store.purgeSections(holiday.id, selected),
            'Selected data erased.',
          );
          if (ok) setSelected([]);
        }}
        title="Erase selected holiday data?"
        description="The holiday itself is kept — only the sections you picked are removed."
        confirmLabel="Erase data"
        body={
          <ul className="space-y-1.5 text-sm text-ink-300">
            {selected.map((section) => (
              <li key={section}>
                · {DATA_SECTION_LABELS[section]} —{' '}
                {counts[section]} item{counts[section] === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        }
      />

      <ConfirmDialog
        open={deleting}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          setDeleting(false);
          const ok = await toast.fromResult(
            // The API re-checks this name server-side before deleting.
            store.deleteHoliday(holiday.id, holiday.name),
            `${holiday.name} was permanently deleted.`,
          );
          if (ok) router.push('/');
        }}
        title={`Permanently delete “${holiday.name}”?`}
        description="Everyone loses access immediately and nothing can be recovered."
        confirmLabel="Delete forever"
        requirePhrase={holiday.name}
        body={
          <div className="space-y-3">
            <p className="text-sm text-ink-300">
              Deleting this holiday will permanently remove:
            </p>
            <ul className="space-y-1.5 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-ink-300">
              <li>· {counts.itinerary} itinerary item{counts.itinerary === 1 ? '' : 's'}</li>
              <li>· {counts.bookings} booking{counts.bookings === 1 ? '' : 's'}</li>
              <li>· {counts.expenses} expense{counts.expenses === 1 ? '' : 's'}</li>
              <li>· {counts.documents} document{counts.documents === 1 ? '' : 's'}</li>
              <li>· {counts.chat} chat message{counts.chat === 1 ? '' : 's'}</li>
              <li>· {counts.photos} photo{counts.photos === 1 ? '' : 's'}</li>
              <li>
                · Access for all {holiday.members.length} member
                {holiday.members.length === 1 ? '' : 's'}
              </li>
            </ul>
          </div>
        }
      />
    </div>
  );
}
