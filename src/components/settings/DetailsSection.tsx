'use client';

import { useEffect, useMemo, useState } from 'react';

import { useToast } from '@/components/Toast';
import { Field, TagInput } from '@/components/ui';
import { COVER_PRESETS, isImageUrl } from '@/lib/covers';
import { COUNTRIES, COUNTRY_CURRENCY } from '@/lib/currency';
import { useStore } from '@/lib/store';
import type { Holiday, HolidayDetailsDraft } from '@/lib/types';
import { cx } from '@/lib/utils';

function toDraft(holiday: Holiday): HolidayDetailsDraft {
  return {
    name: holiday.name,
    country: holiday.country,
    cities: [...holiday.cities],
    startDate: holiday.startDate,
    endDate: holiday.endDate,
    departure: { ...holiday.departure },
    arrival: { ...holiday.arrival },
    primaryCurrency: holiday.primaryCurrency,
    secondaryCurrencies: [...holiday.secondaryCurrencies],
    coverImage: holiday.coverImage,
    description: holiday.description,
  };
}

export function DetailsSection({
  holiday,
  readOnly,
}: {
  holiday: Holiday;
  readOnly: boolean;
}) {
  const { updateHolidayDetails } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<HolidayDetailsDraft>(() => toDraft(holiday));

  // Pull in changes another member made while this form was open, but only when
  // the local form has no unsaved edits.
  const serialised = JSON.stringify(toDraft(holiday));
  useEffect(() => {
    setDraft((current) => {
      const dirty = JSON.stringify(current) !== serialised;
      return dirty ? current : JSON.parse(serialised);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialised]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== serialised,
    [draft, serialised],
  );

  function set<K extends keyof HolidayDetailsDraft>(
    key: K,
    value: HolidayDetailsDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setLeg(
    leg: 'departure' | 'arrival',
    key: keyof HolidayDetailsDraft['departure'],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [leg]: { ...current[leg], [key]: value },
    }));
  }

  function save() {
    if (!draft.name.trim()) {
      toast.error('The holiday needs a name.');
      return;
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      toast.error('The end date cannot be before the start date.');
      return;
    }
    toast.fromResult(
      updateHolidayDetails(holiday.id, draft),
      'Holiday updated for everyone.',
    );
  }

  const customCover = isImageUrl(draft.coverImage);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Holiday name" htmlFor="set-name">
            <input
              id="set-name"
              className="field"
              disabled={readOnly}
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Country" htmlFor="set-country">
          <select
            id="set-country"
            className="field"
            disabled={readOnly}
            value={draft.country}
            onChange={(event) => {
              const country = event.target.value;
              setDraft((current) => ({
                ...current,
                country,
                primaryCurrency:
                  COUNTRY_CURRENCY[country] ?? current.primaryCurrency,
              }));
            }}
          >
            {[...new Set([...COUNTRIES, draft.country])].sort().map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Cities"
          htmlFor="set-cities"
          hint="Multi-city trips are fine — add every stop."
        >
          <TagInput
            id="set-cities"
            disabled={readOnly}
            values={draft.cities}
            onChange={(cities) => set('cities', cities)}
            placeholder="Add a city"
          />
        </Field>

        <Field label="Start date" htmlFor="set-start">
          <input
            id="set-start"
            type="date"
            className="field"
            disabled={readOnly}
            value={draft.startDate}
            onChange={(event) => set('startDate', event.target.value)}
          />
        </Field>

        <Field label="End date" htmlFor="set-end">
          <input
            id="set-end"
            type="date"
            className="field"
            disabled={readOnly}
            value={draft.endDate}
            onChange={(event) => set('endDate', event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="panel-flat p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-gold-500">
            Departure
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Date" htmlFor="dep-date">
              <input
                id="dep-date"
                type="date"
                className="field"
                disabled={readOnly}
                value={draft.departure.date}
                onChange={(event) => setLeg('departure', 'date', event.target.value)}
              />
            </Field>
            <Field label="Time" htmlFor="dep-time">
              <input
                id="dep-time"
                type="time"
                className="field"
                disabled={readOnly}
                value={draft.departure.time}
                onChange={(event) => setLeg('departure', 'time', event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="From" htmlFor="dep-location">
                <input
                  id="dep-location"
                  className="field"
                  disabled={readOnly}
                  placeholder="London Gatwick (LGW)"
                  value={draft.departure.location}
                  onChange={(event) =>
                    setLeg('departure', 'location', event.target.value)
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Reference" htmlFor="dep-ref">
                <input
                  id="dep-ref"
                  className="field"
                  disabled={readOnly}
                  placeholder="Flight or train number"
                  value={draft.departure.reference}
                  onChange={(event) =>
                    setLeg('departure', 'reference', event.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        </fieldset>

        <fieldset className="panel-flat p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-gold-500">
            Arrival home
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Date" htmlFor="arr-date">
              <input
                id="arr-date"
                type="date"
                className="field"
                disabled={readOnly}
                value={draft.arrival.date}
                onChange={(event) => setLeg('arrival', 'date', event.target.value)}
              />
            </Field>
            <Field label="Time" htmlFor="arr-time">
              <input
                id="arr-time"
                type="time"
                className="field"
                disabled={readOnly}
                value={draft.arrival.time}
                onChange={(event) => setLeg('arrival', 'time', event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Into" htmlFor="arr-location">
                <input
                  id="arr-location"
                  className="field"
                  disabled={readOnly}
                  placeholder="London Gatwick (LGW)"
                  value={draft.arrival.location}
                  onChange={(event) =>
                    setLeg('arrival', 'location', event.target.value)
                  }
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Reference" htmlFor="arr-ref">
                <input
                  id="arr-ref"
                  className="field"
                  disabled={readOnly}
                  placeholder="Flight or train number"
                  value={draft.arrival.reference}
                  onChange={(event) =>
                    setLeg('arrival', 'reference', event.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        </fieldset>
      </div>

      <Field label="Cover image" hint="Pick a preset or paste an https image URL.">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {COVER_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={readOnly}
              title={preset.label}
              aria-label={preset.label}
              onClick={() => set('coverImage', preset.key)}
              style={{ background: preset.gradient }}
              className={cx(
                'h-11 rounded-lg border transition disabled:cursor-not-allowed',
                draft.coverImage === preset.key
                  ? 'border-gold-400 ring-2 ring-gold-500/35'
                  : 'border-white/10 hover:border-white/25',
              )}
            />
          ))}
        </div>
        <input
          className="field mt-2"
          disabled={readOnly}
          placeholder="https://images.example.com/cover.jpg"
          value={customCover ? draft.coverImage : ''}
          onChange={(event) => set('coverImage', event.target.value)}
        />
      </Field>

      <Field label="Description" htmlFor="set-description">
        <textarea
          id="set-description"
          className="field min-h-24 resize-y"
          disabled={readOnly}
          value={draft.description}
          onChange={(event) => set('description', event.target.value)}
        />
      </Field>

      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/7 pt-4">
          {dirty ? (
            <span className="mr-auto text-xs text-gold-400">
              Unsaved changes
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!dirty}
            onClick={() => setDraft(toDraft(holiday))}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty}
            onClick={save}
          >
            Save changes
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-ink-400">
          You have read-only access to this holiday’s details.
        </p>
      )}
    </div>
  );
}
