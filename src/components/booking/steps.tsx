'use client';

import { HiCheck } from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import { formatDuration, formatPrice } from '@/lib/booking/format';
import type { CatalogCategory, CatalogTreatment } from '@/lib/booking/types';
import { cn } from '@/lib/utils';

export function StepHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-[28px] leading-tight text-ink sm:text-[32px]">{children}</h2>;
}

// -----------------------------------------------------------------------------
// 1. Category
// -----------------------------------------------------------------------------
export function CategoryStep({ categories, onSelect }: { categories: CatalogCategory[]; onSelect: (slug: string) => void }) {
  const t = useTranslations('booking.category');
  return (
    <div>
      <StepHeading>{t('title')}</StepHeading>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.slug}>
            <button
              type="button"
              onClick={() => onSelect(c.slug)}
              className="group flex w-full items-center gap-4 rounded-[20px] border border-stone bg-white/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-bronze hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {c.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              )}
              <span className="flex flex-col gap-1">
                <span className="font-serif text-xl text-ink">{c.name}</span>
                <span className="text-sm text-muted">{t('treatments', { count: c.treatments.length })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 2. Treatment
// -----------------------------------------------------------------------------
function treatmentPriceLabel(t: CatalogTreatment) {
  // Laser: the session itself is free, the areas carry the price
  if (t.options.length > 0 && t.priceCents === 0) {
    const cheapest = Math.min(...t.options.map((o) => o.priceCents));
    return formatPrice(cheapest, 'from');
  }
  return formatPrice(t.priceCents, t.priceType);
}

export function TreatmentStep({
  category,
  selectedId,
  onSelect,
}: {
  category: CatalogCategory;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('booking.treatment');
  const groups = [...new Set(category.treatments.map((x) => x.menuGroup ?? ''))];

  return (
    <div>
      <StepHeading>{t('title')}</StepHeading>
      <div className="mt-6 flex flex-col gap-7">
        {groups.map((group) => (
          <section key={group || 'all'}>
            {group && <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{group}</h3>}
            <ul className="grid gap-3">
              {category.treatments
                .filter((x) => (x.menuGroup ?? '') === group)
                .map((treatment) => {
                  const active = treatment.id === selectedId;
                  return (
                    <li key={treatment.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(treatment.id)}
                        aria-pressed={active}
                        className={cn(
                          'flex w-full flex-col gap-2 rounded-[20px] border bg-white/70 p-5 text-left transition hover:border-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          active ? 'border-cocoa ring-1 ring-cocoa' : 'border-stone',
                        )}
                      >
                        <span className="flex items-start justify-between gap-4">
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-serif text-xl text-ink">{treatment.name}</span>
                            {treatment.isBestSeller && (
                              <span className="rounded-full bg-sand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-bronze">
                                {t('bestSeller')}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-serif text-xl text-ink">{treatmentPriceLabel(treatment)}</span>
                        </span>
                        {treatment.description && <span className="text-sm leading-relaxed text-muted">{treatment.description}</span>}
                        {treatment.includes.length > 0 && (
                          <span className="text-sm text-muted">
                            <span className="font-medium text-ink">{t('includes')}: </span>
                            {treatment.includes.join(' · ')}
                          </span>
                        )}
                        {treatment.options.length === 0 && (
                          <span className="text-xs uppercase tracking-[0.12em] text-bronze">{formatDuration(treatment.durationMinutes)}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 3. Options (laser areas, add-ons)
// -----------------------------------------------------------------------------
export function OptionsStep({
  treatment,
  selected,
  onToggle,
}: {
  treatment: CatalogTreatment;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const t = useTranslations('booking.options');
  const groups = [...new Set(treatment.options.map((o) => o.groupLabel ?? ''))];
  const atMax = treatment.maxOptions !== null && selected.length >= treatment.maxOptions;

  return (
    <div>
      <StepHeading>{t('title')}</StepHeading>
      <p className="mt-2 text-sm text-muted">
        {treatment.maxOptions === null
          ? t('hintMin', { min: Math.max(treatment.minOptions, 0) })
          : t('hintRange', { min: treatment.minOptions, max: treatment.maxOptions })}{' '}
        <span className="font-medium text-ink">{t('selected', { count: selected.length })}</span>
      </p>
      <div className="mt-6 flex flex-col gap-7">
        {groups.map((group) => (
          <fieldset key={group || 'all'}>
            {group && <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{group}</legend>}
            <div className="grid gap-2.5 sm:grid-cols-2">
              {treatment.options
                .filter((o) => (o.groupLabel ?? '') === group)
                .map((option) => {
                  const checked = selected.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-2xl border bg-white/70 px-4 py-3.5 transition hover:border-bronze has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                        checked ? 'border-cocoa ring-1 ring-cocoa' : 'border-stone',
                        !checked && atMax && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={!checked && atMax}
                        onChange={() => onToggle(option.id)}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                          checked ? 'border-cocoa bg-cocoa text-cream' : 'border-taupe bg-white',
                        )}
                      >
                        {checked && <HiCheck className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex flex-1 flex-col">
                        <span className="text-[15px] font-medium text-ink">{option.name}</span>
                        <span className="text-xs text-muted">{t('addMinutes', { minutes: option.extraMinutes })}</span>
                      </span>
                      <span className="font-serif text-lg text-ink">{formatPrice(option.priceCents, option.priceType)}</span>
                    </label>
                  );
                })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
