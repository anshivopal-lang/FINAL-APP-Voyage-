'use client';

import { useMemo, useState } from 'react';

import {
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  FileIcon,
  ImageIcon,
  LockIcon,
  MapPinIcon,
  PlaneIcon,
  PlusIcon,
  TrashIcon,
  WalletIcon,
} from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { Avatar, Badge, EmptyState, Field, SectionTitle } from '@/components/ui';
import { convert, CURRENCIES, formatMoney } from '@/lib/currency';
import { useStore } from '@/lib/store';
import type { Booking, Expense, Holiday, HolidayDocument } from '@/lib/types';
import {
  cx,
  formatDate,
  formatDateLong,
  formatTimestamp,
  nowIso,
} from '@/lib/utils';

interface PanelProps {
  holiday: Holiday;
  readOnly: boolean;
}

/* -- Itinerary ---------------------------------------------------------- */

export function ItineraryPanel({ holiday, readOnly }: PanelProps) {
  const { addItineraryItem, removeItineraryItem } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState({
    title: '',
    date: holiday.startDate,
    time: '',
    city: holiday.cities[0] ?? '',
    notes: '',
  });

  const byDay = useMemo(() => {
    const groups = new Map<string, typeof holiday.itinerary>();
    for (const item of [...holiday.itinerary].sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    )) {
      const key = item.date || 'unscheduled';
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [holiday.itinerary]);

  async function add() {
    if (!draft.title.trim()) {
      toast.error('Give the plan a title.');
      return;
    }
    if (
      await toast.fromResult(
        addItineraryItem(holiday.id, draft),
        'Added to the itinerary.',
      )
    ) {
      setDraft({ ...draft, title: '', time: '', notes: '' });
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Itinerary"
        subtitle={`${holiday.itinerary.length} plan${holiday.itinerary.length === 1 ? '' : 's'} across the trip`}
      />

      {byDay.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon width={26} height={26} />}
          title="Nothing planned yet"
          description="Add the first stop and the days will organise themselves."
        />
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, items]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-3">
                <p className="eyebrow shrink-0">
                  {day === 'unscheduled'
                    ? 'Not yet scheduled'
                    : formatDateLong(day)}
                </p>
                <span className="rule-gold min-w-0 flex-1 opacity-50" />
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="panel-flat group flex items-start gap-3 px-4 py-3"
                  >
                    <span className="mt-0.5 w-12 shrink-0 text-xs text-ink-400">
                      {item.time || '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-100">{item.title}</p>
                      {item.city ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                          <MapPinIcon width={12} height={12} />
                          {item.city}
                        </p>
                      ) : null}
                      {item.notes ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
                          {item.notes}
                        </p>
                      ) : null}
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        aria-label={`Remove ${item.title}`}
                        onClick={() =>
                          toast.fromResult(
                            removeItineraryItem(holiday.id, item.id),
                            'Removed from the itinerary.',
                          )
                        }
                        className="rounded-lg p-1.5 text-ink-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/6 hover:text-rose-500 focus:opacity-100"
                      >
                        <TrashIcon width={15} height={15} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly ? (
        <div className="panel-flat p-4">
          <p className="mb-3 text-sm font-medium text-ink-200">Add a plan</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="What" htmlFor="itin-title">
                <input
                  id="itin-title"
                  className="field"
                  value={draft.title}
                  placeholder="Boat day to Capri"
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Date" htmlFor="itin-date">
              <input
                id="itin-date"
                type="date"
                className="field"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
            </Field>
            <Field label="Time" htmlFor="itin-time">
              <input
                id="itin-time"
                type="time"
                className="field"
                value={draft.time}
                onChange={(event) =>
                  setDraft({ ...draft, time: event.target.value })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="City" htmlFor="itin-city">
                <input
                  id="itin-city"
                  className="field"
                  list="itin-cities"
                  value={draft.city}
                  onChange={(event) =>
                    setDraft({ ...draft, city: event.target.value })
                  }
                />
                <datalist id="itin-cities">
                  {holiday.cities.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="itin-notes">
                <input
                  id="itin-notes"
                  className="field"
                  value={draft.notes}
                  placeholder="Optional"
                  onChange={(event) =>
                    setDraft({ ...draft, notes: event.target.value })
                  }
                />
              </Field>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn btn-primary" onClick={add}>
              <PlusIcon width={15} height={15} />
              Add plan
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -- Bookings ----------------------------------------------------------- */

const BOOKING_TYPES: Array<{ value: Booking['type']; label: string }> = [
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Stay' },
  { value: 'transport', label: 'Transport' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
];

export function BookingsPanel({ holiday, readOnly }: PanelProps) {
  const { addBooking, removeBooking } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Omit<Booking, 'id'>>({
    title: '',
    type: 'hotel',
    reference: '',
    date: holiday.startDate,
    amount: 0,
    currency: holiday.primaryCurrency,
  });

  const total = holiday.bookings.reduce(
    (sum, booking) =>
      sum + convert(booking.amount, booking.currency, holiday.primaryCurrency),
    0,
  );

  async function add() {
    if (!draft.title.trim()) {
      toast.error('Give the booking a title.');
      return;
    }
    if (await toast.fromResult(addBooking(holiday.id, draft), 'Booking saved.')) {
      setDraft({ ...draft, title: '', reference: '', amount: 0 });
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Bookings"
        subtitle={
          holiday.bookings.length > 0
            ? `${holiday.bookings.length} booked · about ${formatMoney(total, holiday.primaryCurrency)} committed`
            : 'Flights, stays and everything reserved in advance'
        }
      />

      {holiday.bookings.length === 0 ? (
        <EmptyState
          icon={<PlaneIcon width={26} height={26} />}
          title="No bookings recorded"
          description="Keep references here so nobody has to dig through their inbox."
        />
      ) : (
        <div className="space-y-2">
          {[...holiday.bookings]
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            .map((booking) => (
              <div
                key={booking.id}
                className="panel-flat group flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <Badge tone="neutral">
                  {BOOKING_TYPES.find((type) => type.value === booking.type)?.label ??
                    booking.type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-100">{booking.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {formatDate(booking.date)}
                    {booking.reference ? ` · ref ${booking.reference}` : ''}
                  </p>
                </div>
                <span className="text-sm text-ink-200">
                  {formatMoney(booking.amount, booking.currency)}
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    aria-label={`Remove ${booking.title}`}
                    onClick={() =>
                      toast.fromResult(
                        removeBooking(holiday.id, booking.id),
                        'Booking removed.',
                      )
                    }
                    className="rounded-lg p-1.5 text-ink-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/6 hover:text-rose-500 focus:opacity-100"
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                ) : null}
              </div>
            ))}
        </div>
      )}

      {!readOnly ? (
        <div className="panel-flat p-4">
          <p className="mb-3 text-sm font-medium text-ink-200">Record a booking</p>
          <div className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <Field label="Title" htmlFor="bk-title">
                <input
                  id="bk-title"
                  className="field"
                  value={draft.title}
                  placeholder="Le Sirenuse — 9 nights"
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="Type" htmlFor="bk-type">
                <select
                  id="bk-type"
                  className="field"
                  value={draft.type}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      type: event.target.value as Booking['type'],
                    })
                  }
                >
                  {BOOKING_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Date" htmlFor="bk-date">
                <input
                  id="bk-date"
                  type="date"
                  className="field"
                  value={draft.date}
                  onChange={(event) =>
                    setDraft({ ...draft, date: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Reference" htmlFor="bk-ref">
                <input
                  id="bk-ref"
                  className="field"
                  value={draft.reference}
                  placeholder="Optional"
                  onChange={(event) =>
                    setDraft({ ...draft, reference: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Amount" htmlFor="bk-amount">
                <input
                  id="bk-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={draft.amount || ''}
                  onChange={(event) =>
                    setDraft({ ...draft, amount: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Currency" htmlFor="bk-currency">
                <select
                  id="bk-currency"
                  className="field"
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft({ ...draft, currency: event.target.value })
                  }
                >
                  {[holiday.primaryCurrency, ...holiday.secondaryCurrencies].map(
                    (code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn btn-primary" onClick={add}>
              <PlusIcon width={15} height={15} />
              Save booking
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -- Expenses ----------------------------------------------------------- */

const EXPENSE_CATEGORIES: Array<{ value: Expense['category']; label: string }> = [
  { value: 'food', label: 'Food & drink' },
  { value: 'travel', label: 'Travel' },
  { value: 'stay', label: 'Stay' },
  { value: 'activity', label: 'Activity' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
];

export function ExpensesPanel({ holiday, readOnly }: PanelProps) {
  const { addExpense, removeExpense, currentUserId } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Omit<Expense, 'id'>>({
    title: '',
    category: 'food',
    amount: 0,
    currency: holiday.primaryCurrency,
    date: new Date().toISOString().slice(0, 10),
    paidByMemberId:
      holiday.members.find((member) => member.userId === currentUserId)?.id ?? "",
  });

  const total = holiday.expenses.reduce(
    (sum, expense) =>
      sum + convert(expense.amount, expense.currency, holiday.primaryCurrency),
    0,
  );

  const perMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of holiday.expenses) {
      map.set(
        expense.paidByMemberId,
        (map.get(expense.paidByMemberId) ?? 0) +
          convert(expense.amount, expense.currency, holiday.primaryCurrency),
      );
    }
    return map;
  }, [holiday.expenses, holiday.primaryCurrency]);

  async function add() {
    if (!draft.title.trim()) {
      toast.error('Give the expense a title.');
      return;
    }
    if (draft.amount <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (await toast.fromResult(addExpense(holiday.id, draft), 'Expense logged.')) {
      setDraft({ ...draft, title: '', amount: 0 });
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Expenses"
        subtitle={`Total so far — ${formatMoney(total, holiday.primaryCurrency)}`}
      />

      {perMember.size > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {holiday.members
            .filter((member) => perMember.has(member.id))
            .map((member) => (
              <div
                key={member.id}
                className="panel-flat flex items-center gap-2.5 px-3.5 py-2.5"
              >
                <Avatar name={member.name} color={member.avatarColor} size={26} />
                <div className="min-w-0">
                  <p className="truncate text-xs text-ink-300">{member.name}</p>
                  <p className="text-sm text-ink-100">
                    {formatMoney(
                      perMember.get(member.id) ?? 0,
                      holiday.primaryCurrency,
                    )}
                  </p>
                </div>
              </div>
            ))}
        </div>
      ) : null}

      {holiday.expenses.length === 0 ? (
        <EmptyState
          icon={<WalletIcon width={26} height={26} />}
          title="No spending logged"
          description="Add expenses in any of the holiday's currencies — totals convert automatically."
        />
      ) : (
        <div className="space-y-2">
          {[...holiday.expenses]
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .map((expense) => {
              const payer = holiday.members.find(
                (member) => member.id === expense.paidByMemberId,
              );

              return (
                <div
                  key={expense.id}
                  className="panel-flat group flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <Badge tone="neutral">
                    {EXPENSE_CATEGORIES.find(
                      (category) => category.value === expense.category,
                    )?.label ?? expense.category}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-100">
                      {expense.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatDate(expense.date)}
                      {payer ? ` · paid by ${payer.name}` : ''}
                    </p>
                  </div>
                  <span className="text-sm text-ink-200">
                    {formatMoney(expense.amount, expense.currency)}
                  </span>
                  {!readOnly ? (
                    <button
                      type="button"
                      aria-label={`Remove ${expense.title}`}
                      onClick={() =>
                        toast.fromResult(
                          removeExpense(holiday.id, expense.id),
                          'Expense removed.',
                        )
                      }
                      className="rounded-lg p-1.5 text-ink-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/6 hover:text-rose-500 focus:opacity-100"
                    >
                      <TrashIcon width={15} height={15} />
                    </button>
                  ) : null}
                </div>
              );
            })}
        </div>
      )}

      {!readOnly ? (
        <div className="panel-flat p-4">
          <p className="mb-3 text-sm font-medium text-ink-200">Log an expense</p>
          <div className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <Field label="What" htmlFor="exp-title">
                <input
                  id="exp-title"
                  className="field"
                  value={draft.title}
                  placeholder="Lunch at Chez Black"
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Category" htmlFor="exp-category">
                <select
                  id="exp-category"
                  className="field"
                  value={draft.category}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      category: event.target.value as Expense['category'],
                    })
                  }
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Amount" htmlFor="exp-amount">
                <input
                  id="exp-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={draft.amount || ''}
                  onChange={(event) =>
                    setDraft({ ...draft, amount: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="Currency" htmlFor="exp-currency">
                <select
                  id="exp-currency"
                  className="field"
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft({ ...draft, currency: event.target.value })
                  }
                >
                  {[holiday.primaryCurrency, ...holiday.secondaryCurrencies].map(
                    (code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="Date" htmlFor="exp-date">
                <input
                  id="exp-date"
                  type="date"
                  className="field"
                  value={draft.date}
                  onChange={(event) =>
                    setDraft({ ...draft, date: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Paid by" htmlFor="exp-payer">
                <select
                  id="exp-payer"
                  className="field"
                  value={draft.paidByMemberId}
                  onChange={(event) =>
                    setDraft({ ...draft, paidByMemberId: event.target.value })
                  }
                >
                  {holiday.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn btn-primary" onClick={add}>
              <PlusIcon width={15} height={15} />
              Log expense
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -- Documents ---------------------------------------------------------- */

const DOCUMENT_TYPES: Array<{ value: HolidayDocument['type']; label: string }> = [
  { value: 'passport', label: 'Passport' },
  { value: 'visa', label: 'Visa' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'reservation', label: 'Reservation' },
  { value: 'other', label: 'Other' },
];

export function DocumentsPanel({ holiday, readOnly }: PanelProps) {
  const { addDocument, removeDocument, toggleDocumentConfidential } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Omit<HolidayDocument, 'id' | 'addedAt'>>({
    name: '',
    type: 'reservation',
    sizeKb: 240,
    confidential: false,
  });

  async function add() {
    if (!draft.name.trim()) {
      toast.error('Give the document a name.');
      return;
    }
    if (await toast.fromResult(addDocument(holiday.id, draft), 'Document added.')) {
      setDraft({ ...draft, name: '' });
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Documents"
        subtitle="Passports, visas, insurance and reservations, kept with the trip."
      />

      {holiday.documents.length === 0 ? (
        <EmptyState
          icon={<FileIcon width={26} height={26} />}
          title="No documents yet"
          description="Confidential documents are only visible to members who can manage documents."
        />
      ) : (
        <div className="space-y-2">
          {holiday.documents.map((doc) => (
            <div
              key={doc.id}
              className="panel-flat group flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span className="text-ink-500">
                <FileIcon width={17} height={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm text-ink-100">
                  {doc.name}
                  {doc.confidential ? (
                    <span className="shrink-0 text-gold-500" title="Confidential">
                      <LockIcon width={13} height={13} />
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {DOCUMENT_TYPES.find((type) => type.value === doc.type)?.label}
                  {' · '}
                  {(doc.sizeKb / 1024).toFixed(1)} MB · added{' '}
                  {formatTimestamp(doc.addedAt)}
                </p>
              </div>
              {!readOnly ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      toast.fromResult(
                        toggleDocumentConfidential(holiday.id, doc.id),
                        doc.confidential
                          ? 'Document is now visible to all members.'
                          : 'Document marked confidential.',
                      )
                    }
                    className="rounded-lg px-2 py-1 text-xs text-ink-400 transition hover:bg-white/6 hover:text-ink-100"
                  >
                    {doc.confidential ? 'Make shared' : 'Mark confidential'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${doc.name}`}
                    onClick={() =>
                      toast.fromResult(
                        removeDocument(holiday.id, doc.id),
                        'Document removed.',
                      )
                    }
                    className="rounded-lg p-1.5 text-ink-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/6 hover:text-rose-500 focus:opacity-100"
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {!readOnly ? (
        <div className="panel-flat p-4">
          <p className="mb-3 text-sm font-medium text-ink-200">Add a document</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="File name" htmlFor="doc-name">
                <input
                  id="doc-name"
                  className="field"
                  value={draft.name}
                  placeholder="Hotel confirmation.pdf"
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Type" htmlFor="doc-type">
              <select
                id="doc-type"
                className="field"
                value={draft.type}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    type: event.target.value as HolidayDocument['type'],
                  })
                }
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visibility" htmlFor="doc-visibility">
              <select
                id="doc-visibility"
                className="field"
                value={draft.confidential ? 'confidential' : 'shared'}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    confidential: event.target.value === 'confidential',
                  })
                }
              >
                <option value="shared">All members</option>
                <option value="confidential">Confidential</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn btn-primary" onClick={add}>
              <PlusIcon width={15} height={15} />
              Add document
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -- Photos ------------------------------------------------------------- */

export function PhotosPanel({ holiday, readOnly }: PanelProps) {
  const { addPhoto, removePhoto } = useStore();
  const toast = useToast();
  const [caption, setCaption] = useState('');

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Photos"
        subtitle={`${holiday.photos.length} in the shared album`}
      />

      {holiday.photos.length === 0 ? (
        <EmptyState
          icon={<ImageIcon width={26} height={26} />}
          title="The album is empty"
          description="Photos added here stay with the holiday, including after it is archived."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {holiday.photos.map((photo) => (
            <figure
              key={photo.id}
              className="group relative overflow-hidden rounded-xl border border-white/8"
            >
              <div
                style={{ background: photo.gradient }}
                className="aspect-4/3 w-full"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent px-3 pt-6 pb-2.5">
                <p className="truncate text-xs text-white/90">{photo.caption}</p>
                <p className="text-[0.6875rem] text-white/50">
                  {formatDate(photo.takenAt.slice(0, 10))}
                </p>
              </figcaption>
              {!readOnly ? (
                <button
                  type="button"
                  aria-label={`Remove ${photo.caption}`}
                  onClick={() =>
                    toast.fromResult(
                      removePhoto(holiday.id, photo.id),
                      'Photo removed.',
                    )
                  }
                  className="absolute top-2 right-2 rounded-lg bg-ink-950/70 p-1.5 text-white/80 opacity-0 transition group-hover:opacity-100 hover:text-rose-500 focus:opacity-100"
                >
                  <TrashIcon width={14} height={14} />
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      )}

      {!readOnly ? (
        <div className="panel-flat flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-0 flex-1">
            <Field label="Caption" htmlFor="photo-caption">
              <input
                id="photo-caption"
                className="field"
                value={caption}
                placeholder="First morning on the terrace"
                onChange={(event) => setCaption(event.target.value)}
              />
            </Field>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              if (
                await toast.fromResult(
                  addPhoto(holiday.id, caption),
                  'Photo added.',
                )
              ) {
                setCaption('');
              }
            }}
          >
            <PlusIcon width={15} height={15} />
            Add to album
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* -- Chat --------------------------------------------------------------- */

export function ChatPanel({ holiday, readOnly }: PanelProps) {
  const { postMessage, currentUserId } = useStore();
  const toast = useToast();
  const [body, setBody] = useState('');

  async function send() {
    if (await toast.fromResult(postMessage(holiday.id, body), 'Message sent.')) {
      setBody('');
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Group chat"
        subtitle="Only members of this holiday can read or post here."
      />

      {holiday.chat.length === 0 ? (
        <EmptyState
          icon={<ChatIcon width={26} height={26} />}
          title="No messages yet"
          description="Say hello — everyone on the trip will see it."
        />
      ) : (
        <div className="space-y-3">
          {[...holiday.chat]
            .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
            .map((message) => {
              const author = holiday.members.find(
                (member) => member.id === message.memberId,
              );
              const mine = message.userId === currentUserId;

              return (
                <div
                  key={message.id}
                  className={cx('flex gap-2.5', mine && 'flex-row-reverse')}
                >
                  <Avatar
                    name={author?.name ?? 'Former member'}
                    color={author?.avatarColor ?? '#4b5568'}
                    size={30}
                  />
                  <div
                    className={cx(
                      'max-w-[75%] rounded-2xl px-3.5 py-2.5',
                      mine
                        ? 'bg-gold-500/14 text-ink-100'
                        : 'bg-white/5 text-ink-200',
                    )}
                  >
                    <p className="text-[0.6875rem] text-ink-500">
                      {author?.name ?? 'Former member'} ·{' '}
                      {formatTimestamp(message.sentAt)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{message.body}</p>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {!readOnly ? (
        <div className="flex gap-2">
          <input
            className="field"
            value={body}
            placeholder="Write a message…"
            aria-label="Message"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') send();
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={send}
            disabled={!body.trim()}
          >
            Send
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* -- Overview ----------------------------------------------------------- */

export function OverviewPanel({ holiday }: { holiday: Holiday }) {
  const spent = holiday.expenses.reduce(
    (sum, expense) =>
      sum + convert(expense.amount, expense.currency, holiday.primaryCurrency),
    0,
  );
  const committed = holiday.bookings.reduce(
    (sum, booking) =>
      sum + convert(booking.amount, booking.currency, holiday.primaryCurrency),
    0,
  );

  const next = [...holiday.itinerary]
    .filter((item) => item.date && item.date >= nowIso().slice(0, 10))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-200">
            <PlaneIcon width={16} height={16} className="text-gold-500" />
            Travel
          </p>
          <div className="space-y-4">
            <LegRow label="Departure" leg={holiday.departure} />
            <div className="border-t border-white/6" />
            <LegRow label="Arrival home" leg={holiday.arrival} />
          </div>
        </div>

        <div className="panel p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-200">
            <WalletIcon width={16} height={16} className="text-gold-500" />
            Money
          </p>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-400">Primary currency</dt>
              <dd className="text-ink-100">
                {holiday.primaryCurrency} —{' '}
                {CURRENCIES.find(
                  (currency) => currency.code === holiday.primaryCurrency,
                )?.name ?? holiday.primaryCurrency}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-400">Also tracking</dt>
              <dd className="text-ink-100">
                {holiday.secondaryCurrencies.length > 0
                  ? holiday.secondaryCurrencies.join(', ')
                  : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-white/6 pt-3">
              <dt className="text-ink-400">Committed in bookings</dt>
              <dd className="text-ink-100">
                {formatMoney(committed, holiday.primaryCurrency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-400">Logged in expenses</dt>
              <dd className="text-ink-100">
                {formatMoney(spent, holiday.primaryCurrency)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            Cross-currency totals use indicative rates, not a live feed.
          </p>
        </div>
      </div>

      {next ? (
        <div className="panel flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/35 bg-gold-500/12 text-gold-400">
            <ClockIcon width={18} height={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Up next</p>
            <p className="mt-1 text-sm text-ink-100">{next.title}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {formatDateLong(next.date)}
              {next.time ? ` · ${next.time}` : ''}
              {next.city ? ` · ${next.city}` : ''}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CountTile label="Plans" value={holiday.itinerary.length} />
        <CountTile label="Bookings" value={holiday.bookings.length} />
        <CountTile label="Expenses" value={holiday.expenses.length} />
        <CountTile label="Documents" value={holiday.documents.length} />
        <CountTile label="Photos" value={holiday.photos.length} />
        <CountTile label="Messages" value={holiday.chat.length} />
      </div>
    </div>
  );
}

function LegRow({
  label,
  leg,
}: {
  label: string;
  leg: Holiday['departure'];
}) {
  return (
    <div>
      <p className="eyebrow-muted">{label}</p>
      <p className="mt-1.5 text-sm text-ink-100">
        {leg.date ? formatDateLong(leg.date) : 'Date to be confirmed'}
        {leg.time ? ` · ${leg.time}` : ''}
      </p>
      <p className="mt-0.5 text-xs text-ink-400">
        {leg.location || 'Location to be confirmed'}
        {leg.reference ? ` · ${leg.reference}` : ''}
      </p>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel-flat px-3.5 py-4 text-center transition-colors duration-300 hover:border-white/12">
      <p className="numeral text-2xl leading-none text-ink-100">{value}</p>
      <p className="eyebrow-muted mt-2">{label}</p>
    </div>
  );
}
