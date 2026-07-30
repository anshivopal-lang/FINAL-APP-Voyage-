'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Modal } from './Modal';
import { useToast } from './Toast';
import { Field, TagInput } from './ui';
import { COVER_PRESETS } from '@/lib/covers';
import { COUNTRIES, COUNTRY_CURRENCY, CURRENCIES } from '@/lib/currency';
import { useStore } from '@/lib/store';
import { cx } from '@/lib/utils';

const BLANK = {
  name: '',
  country: 'Italy',
  cities: [] as string[],
  startDate: '',
  endDate: '',
  primaryCurrency: 'EUR',
  description: '',
  coverImage: COVER_PRESETS[0].key,
};

export function CreateHolidayDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { createHoliday } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(BLANK);
      setError('');
    }
  }, [open]);

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onCountryChange(country: string) {
    setForm((current) => ({
      ...current,
      country,
      primaryCurrency: COUNTRY_CURRENCY[country] ?? current.primaryCurrency,
    }));
  }

  function submit() {
    if (!form.name.trim()) {
      setError('Give the holiday a name.');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('The end date cannot be before the start date.');
      return;
    }

    const { result, id } = createHoliday(form);
    if (!toast.fromResult(result, `${form.name.trim()} created.`)) return;

    onClose();
    if (id) router.push(`/holidays/${id}`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a holiday"
      description="Start with the essentials — everything else can be edited later."
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            Create holiday
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Holiday name" htmlFor="new-name">
          <input
            id="new-name"
            className="field"
            autoFocus
            value={form.name}
            placeholder="Amalfi Coast Escape"
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="new-country">
            <select
              id="new-country"
              className="field"
              value={form.country}
              onChange={(event) => onCountryChange(event.target.value)}
            >
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Primary currency" htmlFor="new-currency">
            <select
              id="new-currency"
              className="field"
              value={form.primaryCurrency}
              onChange={(event) => set('primaryCurrency', event.target.value)}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Cities"
          htmlFor="new-cities"
          hint="Add as many stops as you like — press Enter after each."
        >
          <TagInput
            id="new-cities"
            values={form.cities}
            onChange={(cities) => set('cities', cities)}
            placeholder="Positano"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="new-start">
            <input
              id="new-start"
              type="date"
              className="field"
              value={form.startDate}
              onChange={(event) => set('startDate', event.target.value)}
            />
          </Field>
          <Field label="End date" htmlFor="new-end">
            <input
              id="new-end"
              type="date"
              className="field"
              value={form.endDate}
              onChange={(event) => set('endDate', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Cover">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {COVER_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                onClick={() => set('coverImage', preset.key)}
                style={{ background: preset.gradient }}
                className={cx(
                  'h-11 rounded-lg border transition',
                  form.coverImage === preset.key
                    ? 'border-gold-400 ring-2 ring-gold-500/35'
                    : 'border-white/10 hover:border-white/25',
                )}
              />
            ))}
          </div>
        </Field>

        <Field label="Description" htmlFor="new-description">
          <textarea
            id="new-description"
            className="field min-h-20 resize-y"
            value={form.description}
            placeholder="What is this trip about?"
            onChange={(event) => set('description', event.target.value)}
          />
        </Field>

        {error ? (
          <p className="rounded-lg border border-rose-500/35 bg-rose-500/8 px-3 py-2 text-sm text-[#e8b9bc]">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
