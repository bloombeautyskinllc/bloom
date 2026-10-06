'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiChevronDown } from 'react-icons/hi';
import { MdDragIndicator } from 'react-icons/md';
import { deleteOption, deleteTreatment, reorderTreatments, saveCategory, saveOption, saveTreatment } from '@/lib/admin/catalog-actions';
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
  /** 0 = choosing an option is optional */
  minOptions: number;
  /** null = no limit */
  maxOptions: number | null;
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

// Server field name → label key in bo.catalog, to say which input was rejected
const FIELD_LABELS = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  priceCents: 'price',
  priceType: 'priceType',
  durationMinutes: 'duration',
  extraMinutes: 'extraMinutes',
  bufferBeforeMin: 'bufferBefore',
  bufferAfterMin: 'bufferAfter',
  depositPercent: 'deposit',
  minOptions: 'minOptions',
  maxOptions: 'maxOptions',
  groupLabel: 'group',
  color: 'color',
} as const;

function useSaver() {
  const t = useTranslations('bo');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const errorText = (r: { error?: string; field?: string }) => {
    if (r.error === 'forbidden') return t('common.forbidden');
    if (r.error === 'duplicate') return t('catalog.duplicate');
    const label = r.error === 'invalid' && r.field ? FIELD_LABELS[r.field as keyof typeof FIELD_LABELS] : undefined;
    return label ? t('catalog.invalidField', { field: t(`catalog.${label}`) }) : t('common.error');
  };
  const save = (fn: () => Promise<{ ok: boolean; error?: string; field?: string }>, onDone?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMessage({ tone: 'success', text: t('catalog.saved') });
        onDone?.();
        router.refresh();
      } else setMessage({ tone: 'error', text: errorText(r) });
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
  categories,
  initial,
  depositPercent,
  onDone,
}: {
  categoryId: string;
  /** Categories the treatment can be moved to (editing only) */
  categories?: { id: string; name: string }[];
  initial?: CatalogTreatmentRow;
  /** Business default (Settings), shown when the treatment has no percentage of its own */
  depositPercent: number;
  onDone: () => void;
}) {
  const t = useTranslations('bo.catalog');
  const tc = useTranslations('bo.common');
  const { pending, message, save } = useSaver();
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const [f, setF] = useState({
    categoryId,
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
    minOptions: String(initial?.minOptions ?? 0),
    maxOptions: initial?.maxOptions?.toString() ?? '',
    isBestSeller: initial?.isBestSeller ?? false,
    isActive: initial?.isActive ?? true,
    needsReview: initial?.needsReview ?? false,
  });
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const id = initial?.id ?? 'new';
  const hasOptions = (initial?.options.length ?? 0) > 0;
  const minOptions = Number(f.minOptions || 0);
  const maxOptions = f.maxOptions === '' ? null : Number(f.maxOptions);
  const rangeInvalid = maxOptions !== null && maxOptions < minOptions;

  return (
    <form
      className="grid gap-3 rounded-xl bg-sand/60 p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (rangeInvalid) return;
        save(
          () =>
            saveTreatment({
              id: initial?.id,
              categoryId: f.categoryId,
              // A hand-typed URL name ("Hydra Facial") is normalized like the automatic one
              slug: slugify(f.slug) || slugify(f.name),
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
              minOptions,
              maxOptions,
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
          <input id={`${id}-name`} required minLength={2} maxLength={120} value={f.name} onChange={up('name')} className={inputClass} />
        </Field>
      </div>
      <Field label={t('slug')} htmlFor={`${id}-slug`}>
        <input id={`${id}-slug`} value={f.slug} placeholder={slugify(f.name)} onChange={up('slug')} className={inputClass} />
      </Field>
      {initial && categories && categories.length > 1 && (
        <Field label={t('category')} htmlFor={`${id}-cat`} hint={f.categoryId !== categoryId ? t('categoryMoveHint') : undefined}>
          <select id={`${id}-cat`} value={f.categoryId} onChange={up('categoryId')} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="sm:col-span-2 lg:col-span-4">
        <Field label={t('description')} htmlFor={`${id}-desc`}>
          <textarea id={`${id}-desc`} rows={2} maxLength={1000} value={f.description} onChange={up('description')} className={`${inputClass} h-auto py-2`} />
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
      {hasOptions && (
        <>
          <Field
            label={t('minOptions')}
            htmlFor={`${id}-minopt`}
            hint={minOptions === 0 && cents(f.price) === 0 ? <span className="text-red-800">{t('optionsFreeWarning')}</span> : t('minOptionsHint')}
          >
            <input id={`${id}-minopt`} type="number" min={0} max={50} step={1} value={f.minOptions} onChange={up('minOptions')} className={inputClass} />
          </Field>
          <Field
            label={t('maxOptions')}
            htmlFor={`${id}-maxopt`}
            hint={rangeInvalid ? <span className="text-red-800">{t('optionsRangeInvalid')}</span> : t('maxOptionsHint')}
          >
            <input id={`${id}-maxopt`} type="number" min={1} max={50} step={1} value={f.maxOptions} onChange={up('maxOptions')} className={inputClass} />
          </Field>
        </>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-4">
        <Check label={t('bestSeller')} checked={f.isBestSeller} onChange={(v) => setF({ ...f, isBestSeller: v })} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pending || deleting || rangeInvalid} className={buttonClass.primary}>
          {pending ? tc('saving') : tc('save')}
        </button>
        {initial && (
          <button
            type="button"
            disabled={pending || deleting}
            className={`${buttonClass.ghost} text-red-800`}
            onClick={() => {
              if (!window.confirm(t('deleteTreatmentConfirm', { name: initial.name }))) return;
              startDelete(async () => {
                const r = await deleteTreatment(initial.id);
                if (r.ok) {
                  onDone();
                  router.refresh();
                } else window.alert(r.error === 'forbidden' ? tc('forbidden') : tc('error'));
              });
            }}
          >
            {tc('delete')}
          </button>
        )}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </form>
  );
}

const OPTION_GRID = 'sm:grid-cols-[1.4fr_1fr_100px_130px_90px_auto_auto]';

/** Edits an existing option, or creates one under `treatmentId` when `option` is omitted */
function OptionRow({ option, treatmentId }: { option?: CatalogOptionRow; treatmentId: string }) {
  const t = useTranslations('bo.catalog');
  const tc = useTranslations('bo.common');
  const router = useRouter();
  const { pending, message, save } = useSaver();
  const [deleting, startDelete] = useTransition();
  const blank = { name: '', group: '', price: '', priceType: 'from' as 'fixed' | 'from', extra: '0', active: true };
  const [f, setF] = useState(
    option
      ? { name: option.name, group: option.groupLabel ?? '', price: dollars(option.priceCents), priceType: option.priceType, extra: option.extraMinutes?.toString() ?? '', active: option.isActive }
      : blank,
  );

  return (
    <form
      className={cn('grid items-center gap-2 border-b border-stone py-2', OPTION_GRID, option && !option.isActive && 'opacity-60')}
      onSubmit={(e) => {
        e.preventDefault();
        save(
          () =>
            saveOption({
              id: option?.id,
              treatmentId,
              slug: option?.slug ?? slugify(f.name),
              groupLabel: f.group,
              name: f.name,
              priceCents: cents(f.price),
              priceType: f.priceType,
              extraMinutes: f.extra === '' ? null : Number(f.extra),
              isActive: f.active,
              needsReview: option?.needsReview ?? false,
            }),
          option ? undefined : () => setF(blank),
        );
      }}
    >
      <input aria-label={t('name')} required placeholder={t('name')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputClass} />
      <input aria-label={t('group')} placeholder={t('group')} value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} className={inputClass} />
      <input aria-label={t('price')} required placeholder={t('price')} type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={inputClass} />
      <select aria-label={t('priceType')} value={f.priceType} onChange={(e) => setF({ ...f, priceType: e.target.value as 'fixed' | 'from' })} className={inputClass}>
        <option value="fixed">{t('fixed')}</option>
        <option value="from">{t('fromPrice')}</option>
      </select>
      <input aria-label={t('extraMinutes')} required type="number" min={0} max={600} step={5} value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} className={inputClass} />
      <Check label={t('optionVisible')} checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending || deleting} className={`${buttonClass.secondary} px-3 py-1.5 text-xs`}>
          {option ? tc('save') : tc('add')}
        </button>
        {option && (
          <button
            type="button"
            disabled={pending || deleting}
            className={`${buttonClass.ghost} px-2 py-1.5 text-xs text-red-800`}
            onClick={() => {
              if (!window.confirm(t('deleteOptionConfirm', { name: option.name }))) return;
              startDelete(async () => {
                const r = await deleteOption(option.id);
                if (r.ok) router.refresh();
                else window.alert(r.error === 'forbidden' ? tc('forbidden') : tc('error'));
              });
            }}
          >
            {tc('delete')}
          </button>
        )}
        {message && <span className={cn('text-xs', message.tone === 'error' ? 'text-red-800' : 'text-emerald-800')}>{message.text}</span>}
      </div>
    </form>
  );
}

function OptionsEditor({ treatment }: { treatment: CatalogTreatmentRow }) {
  const t = useTranslations('bo.catalog');
  const [adding, setAdding] = useState(false);
  const showGrid = treatment.options.length > 0 || adding;
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{t('options')}</h3>
      {!showGrid && <p className="py-2 text-sm text-muted">{t('noOptions')}</p>}
      {showGrid && (
        <div className={cn('hidden gap-2 text-[11px] uppercase tracking-[0.1em] text-muted sm:grid', OPTION_GRID)}>
          <span>{t('name')}</span>
          <span>{t('group')}</span>
          <span>{t('price')}</span>
          <span>{t('priceType')}</span>
          <span>{t('extraMinutes')}</span>
          <span />
          <span />
        </div>
      )}
      {treatment.options.map((o) => (
        <OptionRow key={o.id} option={o} treatmentId={treatment.id} />
      ))}
      {adding ? (
        <OptionRow treatmentId={treatment.id} />
      ) : (
        <button type="button" className={`${buttonClass.ghost} mt-2`} onClick={() => setAdding(true)}>
          + {t('addOption')}
        </button>
      )}
    </div>
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

// Drag animation: the lifted row follows the pointer while the others glide out of its way; on drop (or a
// keyboard move) every row slides from where it was to its new place (FLIP)
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const LIFT_SHADOW = '0 18px 40px -16px rgba(35, 27, 21, 0.35), 0 4px 12px -6px rgba(35, 27, 21, 0.18)';
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Drag = {
  id: string;
  from: number;
  /** Index the row would land on (among the other rows) */
  to: number;
  /** Pointer travel since the drag started */
  dy: number;
};

/**
 * Treatments of one category, reordered by dragging the dotted handle (mouse or touch) or with the arrow keys on it.
 * The new order shows at once and is saved in the background; it reverts if the save fails.
 */
function TreatmentList({
  category,
  categories,
  depositPercent,
  open,
  setOpen,
}: {
  category: CatalogCategoryRow;
  categories: CatalogCategoryRow[];
  depositPercent: number;
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
  const t = useTranslations('bo.catalog');
  const tc = useTranslations('bo.common');
  const byId = new Map(category.treatments.map((x) => [x.id, x]));
  // Order chosen here, ahead of the server; null = the server order
  const [localIds, setLocalIds] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Measured when a drag starts: where the dragged row is and the middle of every other row
  const start = useRef({ y: 0, center: 0, height: 0, middles: [] as number[] });
  // Row positions just before an order change, consumed by the FLIP effect below
  const before = useRef<{ tops: Map<string, number>; dropped?: string } | null>(null);

  // Rows added or removed meanwhile (new treatment, moved to another category) still show up or disappear
  const serverIds = category.treatments.map((x) => x.id);
  const baseIds = localIds ? [...localIds.filter((id) => byId.has(id)), ...serverIds.filter((id) => !localIds.includes(id))] : serverIds;
  const placed = (id: string, to: number) => {
    const next = baseIds.filter((x) => x !== id);
    next.splice(to, 0, id);
    return next;
  };

  const rows = () => Array.from(listRef.current?.children ?? []) as HTMLElement[];
  const measure = () => new Map(rows().map((row) => [row.dataset.id!, row.getBoundingClientRect().top]));

  useLayoutEffect(() => {
    const snapshot = before.current;
    if (!snapshot) return;
    before.current = null;
    if (prefersReducedMotion()) return;
    for (const row of rows()) {
      const id = row.dataset.id!;
      const was = snapshot.tops.get(id);
      if (was === undefined) continue;
      const dy = was - row.getBoundingClientRect().top;
      const dropped = id === snapshot.dropped;
      if (Math.abs(dy) < 0.5 && !dropped) continue;
      row.animate(
        dropped
          ? [
              { transform: `translateY(${dy}px) scale(1.015)`, boxShadow: LIFT_SHADOW },
              { transform: 'none', boxShadow: '0 0 0 0 rgba(35, 27, 21, 0)' },
            ]
          : [{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
        { duration: dropped ? 380 : 300, easing: EASE },
      );
    }
  });

  const commit = (next: string[], dropped?: string) => {
    before.current = { tops: measure(), dropped };
    setDrag(null);
    if (next.join() === baseIds.join()) return;
    const previous = localIds;
    setLocalIds(next);
    void reorderTreatments(category.id, next).then((r) => {
      if (r.ok) return;
      setLocalIds(previous);
      window.alert(r.error === 'forbidden' ? tc('forbidden') : tc('error'));
    });
  };

  const onPointerDown = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const all = rows();
    const self = all.find((row) => row.dataset.id === id)!.getBoundingClientRect();
    start.current = {
      y: e.clientY,
      center: self.top + self.height / 2,
      height: self.height,
      middles: all
        .filter((row) => row.dataset.id !== id)
        .map((row) => {
          const r = row.getBoundingClientRect();
          return r.top + r.height / 2;
        }),
    };
    const from = baseIds.indexOf(id);
    setDrag({ id, from, to: from, dy: 0 });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dy = e.clientY - start.current.y;
    const center = start.current.center + dy;
    setDrag({ ...drag, dy, to: start.current.middles.filter((m) => m < center).length });
  };
  const onPointerUp = () => {
    if (drag) commit(placed(drag.id, drag.to), drag.id);
  };
  const onKeyDown = (id: string) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const from = baseIds.indexOf(id);
    const to = e.key === 'ArrowUp' ? from - 1 : e.key === 'ArrowDown' ? from + 1 : -1;
    if (to < 0 || to >= baseIds.length) return;
    e.preventDefault();
    commit(placed(id, to));
  };

  // While dragging, the rows between the old and the new place move one slot to make room
  const rowStyle = (id: string, index: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    if (id === drag.id)
      return {
        translate: `0 ${drag.dy}px`,
        scale: '1.015',
        boxShadow: LIFT_SHADOW,
        position: 'relative',
        zIndex: 10,
        transition: `scale 200ms ${EASE}, box-shadow 200ms ${EASE}`,
      };
    const shift = drag.from < drag.to && index > drag.from && index <= drag.to ? -1 : drag.to < drag.from && index >= drag.to && index < drag.from ? 1 : 0;
    return { translate: `0 ${shift * start.current.height}px`, transition: `translate 260ms ${EASE}` };
  };

  return (
    <ul ref={listRef} className="divide-y divide-stone">
      {baseIds.map((id, index) => {
        const x = byId.get(id)!;
        const expanded = open === x.id;
        const dragging = drag?.id === x.id;
        return (
          <li key={x.id} data-id={x.id} style={rowStyle(x.id, index)} className={cn('py-1', dragging && 'rounded-xl bg-cream')}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('dragToReorder', { name: x.name })}
                title={t('dragToReorder', { name: x.name })}
                onPointerDown={onPointerDown(x.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => drag && commit(baseIds, drag.id)}
                onKeyDown={onKeyDown(x.id)}
                className={cn('shrink-0 touch-none rounded-md p-1.5 text-muted transition hover:bg-stone/60 hover:text-ink', dragging ? 'cursor-grabbing' : 'cursor-grab')}
              >
                <MdDragIndicator className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : x.id)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-sand/60"
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
            </div>
            {expanded && (
              <div className="flex flex-col gap-4 px-2 pb-4 pt-2">
                <TreatmentForm categoryId={category.id} categories={categories} initial={x} depositPercent={depositPercent} onDone={() => setOpen(null)} />
                <OptionsEditor treatment={x} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
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

          <TreatmentList category={c} categories={categories} depositPercent={depositPercent} open={open} setOpen={setOpen} />

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
