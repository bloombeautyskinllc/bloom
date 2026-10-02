'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { createBookingAsStaff, searchClients, type ClientMatch } from '@/lib/admin/actions';
import { formatDuration, formatMoney } from '@/lib/booking/format';
import { cn } from '@/lib/utils';
import LocalDateTimeInput, { toInstant } from './LocalDateTimeInput';
import { Field, Notice, Panel, buttonClass, inputClass } from './ui';

export type FormTreatment = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  durationMinutes: number;
  options: { id: string; name: string; group: string | null; priceCents: number; extraMinutes: number }[];
};

type Props = {
  treatments: FormTreatment[];
  specialists: { id: string; name: string }[];
  timeZone: string;
  defaultDate: string;
  preselectedClient: ClientMatch | null;
};

const dollarsToCents = (v: string) => (v.trim() === '' ? undefined : Math.round(Number(v) * 100));

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 inline-flex rounded-full border border-taupe bg-white p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-full px-4 py-1.5 text-sm transition', o.value === value ? 'bg-cocoa text-cream' : 'text-ink hover:bg-sand')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function NewBookingForm({ treatments, specialists, timeZone, defaultDate, preselectedClient }: Props) {
  const t = useTranslations('bo');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Client
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<ClientMatch[]>([]);
  const [client, setClient] = useState<ClientMatch | null>(preselectedClient);
  const [newClient, setNewClient] = useState({ fullName: '', email: '', phone: '' });

  // Service
  const [serviceMode, setServiceMode] = useState<'catalog' | 'custom'>('catalog');
  const [treatmentId, setTreatmentId] = useState('');
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [custom, setCustom] = useState({ name: '', duration: '60', price: '' });

  // When, price, extras
  const [when, setWhen] = useState({ date: defaultDate, time: '10:00' });
  const [specialistId, setSpecialistId] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (clientMode !== 'existing' || query.trim().length < 2) return setMatches([]);
    const id = setTimeout(() => searchClients(query).then(setMatches), 250);
    return () => clearTimeout(id);
  }, [query, clientMode]);

  const treatment = treatments.find((x) => x.id === treatmentId) ?? null;
  const catalog = useMemo(() => {
    if (serviceMode === 'custom') return { cents: dollarsToCents(custom.price) ?? 0, minutes: Number(custom.duration) || 0 };
    if (!treatment) return { cents: 0, minutes: 0 };
    const opts = treatment.options.filter((o) => optionIds.includes(o.id));
    return {
      cents: treatment.priceCents + opts.reduce((s, o) => s + o.priceCents, 0),
      minutes: treatment.durationMinutes + opts.reduce((s, o) => s + o.extraMinutes, 0),
    };
  }, [serviceMode, custom, treatment, optionIds]);
  const total = Math.max((dollarsToCents(manualPrice) ?? catalog.cents) - (dollarsToCents(discount) ?? 0), 0);
  const categories = [...new Set(treatments.map((x) => x.category))];

  const submit = () => {
    setError(null);
    const startAt = toInstant(when.date, when.time, timeZone);
    if (!startAt) return;
    const phone = newClient.phone ? parsePhoneNumberFromString(newClient.phone, 'US') : undefined;
    if (newClient.phone && !phone?.isValid()) return setError(t('errors.generic'));

    start(async () => {
      const result = await createBookingAsStaff({
        startAt,
        clientId: clientMode === 'existing' ? client?.id : undefined,
        newClient: clientMode === 'new' ? { fullName: newClient.fullName, email: newClient.email, phoneE164: phone?.number } : undefined,
        treatmentId: serviceMode === 'catalog' ? treatmentId || undefined : undefined,
        optionIds: serviceMode === 'catalog' ? optionIds : [],
        custom: serviceMode === 'custom' ? { name: custom.name, durationMinutes: Number(custom.duration), priceCents: dollarsToCents(custom.price) ?? 0 } : undefined,
        specialistId: specialistId || undefined,
        priceCents: dollarsToCents(manualPrice),
        discountCents: dollarsToCents(discount) ?? 0,
        override,
        overrideReason: override ? overrideReason : undefined,
        notes: notes || undefined,
        notify,
        idempotencyKey,
      });
      if (result.ok) router.push(`/admin/bookings/${result.data.id}?created=1`);
      else setError(t(`errors.${result.error}`));
    });
  };

  return (
    <form
      className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-4">
        <Panel title={t('newBooking.client')}>
          <Toggle
            value={clientMode}
            onChange={setClientMode}
            options={[
              { value: 'existing', label: t('newBooking.existing') },
              { value: 'new', label: t('newBooking.new') },
            ]}
          />
          {clientMode === 'existing' ? (
            client ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-sand px-4 py-3 text-sm">
                <span>
                  <span className="block font-medium text-ink">{client.name}</span>
                  <span className="text-muted">{[client.phone, client.email].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" className={buttonClass.ghost} onClick={() => setClient(null)}>
                  {t('common.clear')}
                </button>
              </div>
            ) : (
              <div>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('newBooking.searchClient')} aria-label={t('newBooking.searchClient')} className={inputClass} />
                {matches.length > 0 && (
                  <ul className="mt-2 divide-y divide-stone rounded-xl border border-stone bg-white">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => setClient(m)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sand">
                          <span>
                            <span className="block text-ink">{m.name}</span>
                            <span className="text-xs text-muted">{[m.phone, m.email].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span className="text-xs text-bronze">{t('newBooking.pickClient')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('newBooking.fullName')} htmlFor="nc-name">
                <input id="nc-name" required value={newClient.fullName} onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })} className={inputClass} />
              </Field>
              <Field label={t('newBooking.email')} htmlFor="nc-email">
                <input id="nc-email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className={inputClass} />
              </Field>
              <Field label={t('newBooking.phone')} htmlFor="nc-phone">
                <input id="nc-phone" type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} className={inputClass} />
              </Field>
            </div>
          )}
        </Panel>

        <Panel title={t('newBooking.service')}>
          <Toggle
            value={serviceMode}
            onChange={setServiceMode}
            options={[
              { value: 'catalog', label: t('newBooking.catalogService') },
              { value: 'custom', label: t('newBooking.customService') },
            ]}
          />
          {serviceMode === 'catalog' ? (
            <div className="flex flex-col gap-3">
              <Field label={t('newBooking.treatment')} htmlFor="nb-treatment">
                <select
                  id="nb-treatment"
                  value={treatmentId}
                  onChange={(e) => {
                    setTreatmentId(e.target.value);
                    setOptionIds([]);
                  }}
                  className={inputClass}
                >
                  <option value="">{t('newBooking.chooseTreatment')}</option>
                  {categories.map((c) => (
                    <optgroup key={c} label={c}>
                      {treatments
                        .filter((x) => x.category === c)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} · {formatMoney(x.priceCents)} · {formatDuration(x.durationMinutes)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              {treatment && treatment.options.length > 0 && (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-ink">{t('newBooking.options')}</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {treatment.options.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sand">
                        <input
                          type="checkbox"
                          checked={optionIds.includes(o.id)}
                          onChange={() => setOptionIds((ids) => (ids.includes(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id]))}
                          className="h-4 w-4 accent-cocoa"
                        />
                        <span className="flex-1 text-ink">{o.name}</span>
                        <span className="text-xs text-muted">
                          {formatMoney(o.priceCents)} · +{o.extraMinutes} {t('common.minutes')}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('newBooking.customName')} htmlFor="cs-name">
                <input id="cs-name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} className={inputClass} />
              </Field>
              <Field label={t('newBooking.customDuration')} htmlFor="cs-duration">
                <input id="cs-duration" type="number" min={5} max={600} step={5} value={custom.duration} onChange={(e) => setCustom({ ...custom, duration: e.target.value })} className={inputClass} />
              </Field>
              <Field label={t('newBooking.customPrice')} htmlFor="cs-price">
                <input id="cs-price" type="number" min={0} step="0.01" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} className={inputClass} />
              </Field>
            </div>
          )}
        </Panel>

        <Panel title={t('newBooking.when')}>
          <div className="flex flex-col gap-3">
            <LocalDateTimeInput idPrefix="nb" date={when.date} time={when.time} onChange={setWhen} />
            {specialists.length > 1 && (
              <Field label={t('newBooking.specialist')} htmlFor="nb-specialist">
                <select id="nb-specialist" value={specialistId} onChange={(e) => setSpecialistId(e.target.value)} className={inputClass}>
                  <option value="">{t('newBooking.anySpecialist')}</option>
                  {specialists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cocoa" />
              {t('booking.override')}
            </label>
            {override && (
              <>
                <Notice>{t('booking.overrideWarning')}</Notice>
                <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder={t('booking.overrideReason')} aria-label={t('booking.overrideReason')} maxLength={500} className={inputClass} />
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-8 xl:self-start">
        <Panel title={t('newBooking.pricing')}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {t('newBooking.catalogPrice', { price: formatMoney(catalog.cents) })} · {formatDuration(catalog.minutes || 0)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('newBooking.manualPrice')} htmlFor="nb-price">
                <input id="nb-price" type="number" min={0} step="0.01" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} className={inputClass} />
              </Field>
              <Field label={t('newBooking.discount')} htmlFor="nb-discount">
                <input id="nb-discount" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <p className="text-lg font-medium tabular-nums text-ink">{t('newBooking.total', { total: formatMoney(total) })}</p>
            <Field label={t('newBooking.notes')} htmlFor="nb-notes">
              <textarea id="nb-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-auto py-2`} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-cocoa" />
              {t('common.notifyClient')}
            </label>
            {error && <Notice tone="error">{error}</Notice>}
            <button type="submit" disabled={pending} className={`${buttonClass.primary} py-3`}>
              {pending ? t('newBooking.creating') : t('newBooking.create')}
            </button>
          </div>
        </Panel>
      </div>
    </form>
  );
}
