'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiChevronDown } from 'react-icons/hi';
import { saveCategory, saveOption, saveTreatment } from '@/lib/admin/catalog-actions';
import { formatDuration, formatMoney } from '@/lib/booking/format';
import { cn } from '@/lib/utils';
import { Field, Notice, buttonClass, inputClass } from './ui';

export type CatalogOptionRow = {
  id: string;
  treatmentId: string;
  slug: string;
  groupLabel: string | null;
  name: string;
  priceCents: number;
  priceType: 'fixed' | 'from';
  extraMinutes: number | null;
  isActive: boolean;
  needsReview: boolean;
};

export type CatalogTreatmentRow = {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string | null;
  includes: string[];
  menuGroup: string | null;
  priceCents: number;
  priceType: 'fixed' | 'from';
  durationMinutes: number | null;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  /** Own deposit percentage; null follows the business default */
  depositPercent: number | null;
  isBestSeller: boolean;
  isActive: boolean;
  needsReview: boolean;
  options: CatalogOptionRow[];
};

export type CatalogCategoryRow = { id: string; name: string; description: string | null; color: string | null; isActive: boolean; treatments: CatalogTreatmentRow[] };

const cents = (v: string) => Math.round(Number(v || 0) * 100);
const dollars = (c: number | null) => (c === null ? '' : String(c / 100));

// Same rounding as public.hold_slot
const depositOf = (priceCents: number, percent: number) => Math.round((priceCents * percent) / 100);

// Treatments priced by their options (e.g. laser areas) have a $0 base: show the percentage instead
const depositAmountLabel = (priceCents: number, percent: number) => (priceCents > 0 ? formatMoney(depositOf(priceCents, percent)) : `${percent}%`);

function depositBreakdown(t: ReturnType<typeof useTranslations<'bo.catalog'>>, priceCents: number, percent: number) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return t('depositInvalid');
  if (percent === 0) return t('depositNone');
  if (priceCents <= 0) return t('depositOfOptions', { percent });
  const deposit = depositOf(priceCents, percent);
  return t('depositBreakdown', { deposit: formatMoney(deposit), total: formatMoney(priceCents), rest: formatMoney(priceCents - deposit) });
}
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

function useSaver() {
  const t = useTranslations('bo');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const save = (fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMessage({ tone: 'success', text: t('catalog.saved') });
        onDone?.();
        router.refresh();
      } else setMessage({ tone: 'error', text: r.error === 'forbidden' ? t('common.forbidden') : t('common.error') });
    });
  return { pending, message, save };
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-cocoa" />
      {label}
    </label>
  );
}

// -----------------------------------------------------------------------------
// Treatment form (edit or create)
// -----------------------------------------------------------------------------
function TreatmentForm({
  categoryId,
  initial,
  depositPercent,
  onDone,
}: {
  categoryId: string;
  initial?: CatalogTreatmentRow;
  /** Business default (Settings), shown when the treatment has no percentage of its own */
  depositPercent: number;
  onDone: () => void;
}) {
  const t = useTranslations('bo.catalog');
  const tc = useTranslations('bo.common');
  const { pending, message, save } = useSaver();
  const [f, setF] = useState({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    description: initial?.description ?? '',
    includes: (initial?.includes ?? []).join('\n'),
    menuGroup: initial?.menuGroup ?? '',
    price: dollars(initial?.priceCents ?? 0),
    priceType: initial?.priceType ?? 'fixed',
    duration: initial?.durationMinutes?.toString() ?? '',
    before: String(initial?.bufferBeforeMin ?? 0),
    after: String(initial?.bufferAfterMin ?? 15),
    deposit: String(initial?.depositPercent ?? depositPercent),
    isBestSeller: initial?.isBestSeller ?? false,
    isActive: initial?.isActive ?? true,
    needsReview: initial?.needsReview ?? false,
  });
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const id = initial?.id ?? 'new';

  return (
    <form
      className="grid gap-3 rounded-xl bg-sand/60 p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(
          () =>
            saveTreatment({
              id: initial?.id,
              categoryId,
              slug: f.slug || slugify(f.name),
              name: f.name,
              description: f.description,
              includes: f.includes.split('\n').map((x) => x.trim()).filter(Boolean),
              menuGroup: f.menuGroup,
              priceCents: cents(f.price),
              priceType: f.priceType as 'fixed' | 'from',
              durationMinutes: f.duration ? Number(f.duration) : null,
              bufferBeforeMin: Number(f.before || 0),
              bufferAfterMin: Number(f.after || 0),
              // Same as the business default = follow it (so changing Settings updates this treatment)
              depositPercent: f.deposit === '' || Number(f.deposit) === depositPercent ? null : Number(f.deposit),
              isBestSeller: f.isBestSeller,
              isActive: f.isActive,
              needsReview: f.needsReview,
            }),
          initial ? undefined : onDone,
        );
      }}
    >
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label={t('name')} htmlFor={`${id}-name`}>
          <input id={`${id}-name`} required value={f.name} onChange={up('name')} className={inputClass} />
        </Field>
      </div>
      <Field label={t('slug')} htmlFor={`${id}-slug`}>
        <input id={`${id}-slug`} value={f.slug} placeholder={slugify(f.name)} onChange={up('slug')} className={inputClass} />
      </Field>
      <div className="sm:col-span-2 lg:col-span-4">
        <Field label={t('description')} htmlFor={`${id}-desc`}>
          <textarea id={`${id}-desc`} rows={2} value={f.description} onChange={up('description')} className={`${inputClass} h-auto py-2`} />
        </Field>
      </div>
      <Field label={t('price')} htmlFor={`${id}-price`}>
        <input id={`${id}-price`} type="number" min={0} step="0.01" value={f.price} onChange={up('price')} className={inputClass} />
      </Field>
      <Field label={t('priceType')} htmlFor={`${id}-ptype`}>
        <select id={`${id}-ptype`} value={f.priceType} onChange={up('priceType')} className={inputClass}>
          <option value="fixed">{t('fixed')}</option>
          <option value="from">{t('fromPrice')}</option>
        </select>
      </Field>
      <Field label={t('duration')} htmlFor={`${id}-dur`}>
        <input id={`${id}-dur`} type="number" min={5} max={600} step={5} value={f.duration} onChange={up('duration')} className={inputClass} />
      </Field>
      <Field label={t('deposit')} htmlFor={`${id}-dep`} hint={depositBreakdown(t, cents(f.price), f.deposit === '' ? depositPercent : Number(f.deposit))}>
        <input id={`${id}-dep`} type="number" min={0} max={100} step={1} value={f.deposit} onChange={up('deposit')} className={inputClass} />
      </Field>
      <Field label={t('bufferBefore')} htmlFor={`${id}-bb`}>
        <input id={`${id}-bb`} type="number" min={0} max={240} step={5} value={f.before} onChange={up('before')} className={inputClass} />
      </Field>
      <Field label={t('bufferAfter')} htmlFor={`${id}-ba`}>
        <input id={`${id}-ba`} type="number" min={0} max={240} step={5} value={f.after} onChange={up('after')} className={inputClass} />
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-4">
        <Check label={t('bestSeller')} checked={f.isBestSeller} onChange={(v) => setF({ ...f, isBestSeller: v })} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? tc('saving') : tc('save')}
        </button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </form>
  );
}

function OptionRow({ option }: { option: CatalogOptionRow }) {
  const t = useTranslations('bo.catalog');
  const tc = useTranslations('bo.common');
  const { pending, message, save } = useSaver();
  const [f, setF] = useState({ name: option.name, group: option.groupLabel ?? '', price: dollars(option.priceCents), extra: option.extraMinutes?.toString() ?? '', active: option.isActive, review: option.needsReview });

  return (
    <form
      className="grid items-end gap-2 border-b border-stone py-2 sm:grid-cols-[1.4fr_1fr_110px_110px_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        save(() =>
          saveOption({
            id: option.id,
            treatmentId: option.treatmentId,
            slug: option.slug,
            groupLabel: f.group,
            name: f.name,
            priceCents: cents(f.price),
            priceType: option.priceType,
            extraMinutes: f.extra === '' ? null : Number(f.extra),
            isActive: f.active,
            needsReview: f.review,
          }),
        );
      }}
    >
      <input aria-label={t('name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputClass} />
      <input aria-label={t('group')} value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} className={inputClass} />
      <input aria-label={t('price')} type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={inputClass} />
      <input aria-label={t('extraMinutes')} type="number" min={0} max={600} step={5} value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} className={inputClass} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${buttonClass.secondary} px-3 py-1.5 text-xs`}>
          {tc('save')}
        </button>
        {message && <span className={cn('text-xs', message.tone === 'error' ? 'text-red-800' : 'text-emerald-800')}>{message.text}</span>}
      </div>
    </form>
  );
}

function CategoryHeader({ category }: { category: CatalogCategoryRow }) {
  const t = useTranslations('bo.catalog');
  const tc = useTranslations('bo.common');
  const { pending, save } = useSaver();
  const [color, setColor] = useState(category.color ?? '#725F4C');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted">
        {t('color')}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-taupe" />
      </label>
      <button
        type="button"
        disabled={pending}
        className={`${buttonClass.secondary} px-3 py-1.5 text-xs`}
        onClick={() => save(() => saveCategory({ id: category.id, name: category.name, description: category.description ?? undefined, color, isActive: category.isActive }))}
      >
        {tc('save')}
      </button>
    </div>
  );
}

export default function CatalogEditor({ categories, depositPercent }: { categories: CatalogCategoryRow[]; depositPercent: number }) {
  const t = useTranslations('bo.catalog');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {categories.map((c) => (
        <section key={c.id} className="rounded-2xl border border-stone bg-cream p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-3 font-serif text-2xl text-ink">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color ?? '#725F4C' }} aria-hidden />
              {c.name}
            </h2>
            <CategoryHeader category={c} />
          </div>

          <ul className="divide-y divide-stone">
            {c.treatments.map((x) => {
              const expanded = open === x.id;
              return (
                <li key={x.id} className="py-1">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : x.id)}
                    aria-expanded={expanded}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-sand/60"
                  >
                    <span className={cn('min-w-0 flex-1 font-medium', x.isActive ? 'text-ink' : 'text-muted line-through')}>{x.name}</span>
                    {x.durationMinutes === null && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-900">{t('noDuration')}</span>}
                    <span className="w-24 tabular-nums text-muted">{x.durationMinutes ? formatDuration(x.durationMinutes) : '—'}</span>
                    <span className="w-32 text-right text-xs tabular-nums text-muted">
                      {t('depositShort', { amount: depositAmountLabel(x.priceCents, x.depositPercent ?? depositPercent) })}
                    </span>
                    <span className="w-24 text-right tabular-nums text-ink">
                      {x.priceType === 'from' ? 'from ' : ''}
                      {formatMoney(x.priceCents)}
                    </span>
                    <HiChevronDown className={cn('h-4 w-4 text-muted transition', expanded && 'rotate-180')} />
                  </button>
                  {expanded && (
                    <div className="flex flex-col gap-4 px-2 pb-4 pt-2">
                      <TreatmentForm categoryId={c.id} initial={x} depositPercent={depositPercent} onDone={() => setOpen(null)} />
                      {x.options.length > 0 && (
                        <div>
                          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{t('options')}</h3>
                          <div className="hidden gap-2 text-[11px] uppercase tracking-[0.1em] text-muted sm:grid sm:grid-cols-[1.4fr_1fr_110px_110px_auto]">
                            <span>{t('name')}</span>
                            <span>{t('group')}</span>
                            <span>{t('price')}</span>
                            <span>{t('extraMinutes')}</span>
                            <span />
                          </div>
                          {x.options.map((o) => (
                            <OptionRow key={o.id} option={o} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {adding === c.id ? (
            <div className="mt-4">
              <TreatmentForm categoryId={c.id} depositPercent={depositPercent} onDone={() => setAdding(null)} />
            </div>
          ) : (
            <button type="button" className={`${buttonClass.ghost} mt-3`} onClick={() => setAdding(c.id)}>
              + {t('addTreatment')}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
