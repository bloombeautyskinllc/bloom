'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiArrowDown, HiArrowUp } from 'react-icons/hi';
import { testimonialPlacements } from '@/data/testimonials';
import { deleteTestimonial, reorderTestimonials, saveTestimonial } from '@/lib/admin/testimonial-actions';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Field, Notice, buttonClass, inputClass } from './ui';

export type TestimonialRow = {
  id: string;
  quote: string;
  body: string;
  treatment: string | null;
  tag: string | null;
  rating: number;
  imageUrl: string;
  imageAlt: string | null;
  storagePath: string | null;
  placements: string[];
  isActive: boolean;
};

const placementLabel = new Map(testimonialPlacements.map((p) => [p.id, p.label]));

function useAction() {
  const t = useTranslations('bo');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMessage({ tone: 'success', text: t('common.saved') });
        onDone?.();
        router.refresh();
      } else setMessage({ tone: 'error', text: r.error === 'forbidden' ? t('common.forbidden') : t('common.error') });
    });
  return { pending, message, run, setMessage };
}

const MAX_WIDTH = 1200;

/** Phone photos are large: scale down to MAX_WIDTH and re-encode as WebP before uploading */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  return blob ?? file;
}

// Uploads straight to the public bucket (RLS: admins only), so large files never pass through a server action
async function uploadPhoto(file: File) {
  const blob = await shrink(file);
  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const path = `${crypto.randomUUID()}.${ext}`;
  const storage = createClient().storage.from('testimonials');
  const { error } = await storage.upload(path, blob, { contentType: blob.type || file.type, upsert: false });
  if (error) throw error;
  return { path, url: storage.getPublicUrl(path).data.publicUrl };
}

function TestimonialForm({ testimonial, onDone }: { testimonial?: TestimonialRow; onDone: () => void }) {
  const t = useTranslations('bo');
  const { pending, message, run, setMessage } = useAction();
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({
    quote: testimonial?.quote ?? '',
    body: testimonial?.body ?? '',
    treatment: testimonial?.treatment ?? '',
    tag: testimonial?.tag ?? '',
    rating: testimonial?.rating ?? 5,
    imageUrl: testimonial?.imageUrl ?? '',
    imageAlt: testimonial?.imageAlt ?? '',
    storagePath: testimonial?.storagePath ?? null,
    placements: testimonial?.placements ?? ['home'],
    isActive: testimonial?.isActive ?? true,
  });
  const id = testimonial?.id ?? 'new';

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const { path, url } = await uploadPhoto(file);
      setF((x) => ({ ...x, imageUrl: url, storagePath: path }));
    } catch {
      setMessage({ tone: 'error', text: t('testimonials.uploadFailed') });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-sand/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.imageUrl) return setMessage({ tone: 'error', text: t('testimonials.photoRequired') });
        run(() => saveTestimonial({ id: testimonial?.id, ...f }), onDone);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="flex flex-col gap-2">
          <div className="aspect-[5/7] w-full overflow-hidden rounded-xl border border-taupe bg-white">
            {f.imageUrl ? (
              <img src={f.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <p className="grid h-full place-items-center p-3 text-center text-xs text-muted">{t('testimonials.noPhoto')}</p>
            )}
          </div>
          <label className={cn(buttonClass.secondary, 'cursor-pointer', uploading && 'pointer-events-none opacity-50')}>
            {uploading ? t('testimonials.uploading') : f.imageUrl ? t('testimonials.replacePhoto') : t('testimonials.uploadPhoto')}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <Field label={t('testimonials.quote')} htmlFor={`${id}-quote`} hint={t('testimonials.quoteHint')}>
            <input id={`${id}-quote`} required maxLength={200} value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('testimonials.body')} htmlFor={`${id}-body`}>
            <textarea id={`${id}-body`} required rows={4} maxLength={1000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={`${inputClass} h-auto py-2`} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label={t('testimonials.treatment')} htmlFor={`${id}-treatment`} hint={t('testimonials.optional')}>
              <input id={`${id}-treatment`} maxLength={80} value={f.treatment} onChange={(e) => setF({ ...f, treatment: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t('testimonials.tag')} htmlFor={`${id}-tag`} hint={t('testimonials.tagHint')}>
              <input id={`${id}-tag`} maxLength={40} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t('testimonials.rating')} htmlFor={`${id}-rating`}>
              <select id={`${id}-rating`} value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })} className={inputClass}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('testimonials.imageAlt')} htmlFor={`${id}-alt`} hint={t('testimonials.imageAltHint')}>
            <input id={`${id}-alt`} maxLength={200} value={f.imageAlt} onChange={(e) => setF({ ...f, imageAlt: e.target.value })} className={inputClass} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">{t('testimonials.placements')}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {testimonialPlacements.map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={f.placements.includes(p.id)}
                    onChange={() => setF({ ...f, placements: f.placements.includes(p.id) ? f.placements.filter((x) => x !== p.id) : [...f.placements, p.id] })}
                    className="h-4 w-4 accent-cocoa"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="h-4 w-4 accent-cocoa" />
            {t('testimonials.visible')}
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || uploading} className={buttonClass.primary}>
          {pending ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" onClick={onDone} className={buttonClass.ghost}>
          {t('common.cancel')}
        </button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </form>
  );
}

export default function TestimonialsEditor({ testimonials }: { testimonials: TestimonialRow[] }) {
  const t = useTranslations('bo');
  const { pending, message, run } = useAction();
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);

  const shown = filter === 'all' ? testimonials : testimonials.filter((x) => x.placements.includes(filter));

  // Swaps with the neighbour in the filtered view, then saves the full order
  const move = (id: string, dir: -1 | 1) => {
    const i = shown.findIndex((x) => x.id === id);
    const other = shown[i + dir];
    if (!other) return;
    const ids = testimonials.map((x) => x.id);
    const a = ids.indexOf(id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    run(() => reorderTestimonials(ids));
  };

  const remove = (row: TestimonialRow) => {
    if (!window.confirm(t('testimonials.confirmDelete', { quote: row.quote }))) return;
    run(() => deleteTestimonial(row.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {[{ id: 'all', label: t('common.all') }, ...testimonialPlacements].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setFilter(p.id)}
            aria-pressed={filter === p.id}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition',
              filter === p.id ? 'border-cocoa bg-cocoa text-cream' : 'border-taupe bg-white text-ink hover:border-bronze',
            )}
          >
            {p.label}
            <span className="ml-1.5 text-xs opacity-70">{p.id === 'all' ? testimonials.length : testimonials.filter((x) => x.placements.includes(p.id)).length}</span>
          </button>
        ))}
      </div>

      {message?.tone === 'error' && <Notice tone="error">{message.text}</Notice>}

      {shown.length === 0 && <p className="text-sm text-muted">{t('testimonials.empty')}</p>}

      <ul className="flex flex-col gap-3">
        {shown.map((row, i) =>
          editing === row.id ? (
            <li key={row.id}>
              <TestimonialForm testimonial={row} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={row.id} className={cn('flex gap-4 rounded-xl border border-stone bg-white p-3', !row.isActive && 'opacity-60')}>
              <img src={row.imageUrl} alt="" className="h-[98px] w-[70px] shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl leading-tight text-ink">“{row.quote}”</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{row.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {!row.isActive && <span className="rounded-full border border-stone bg-stone px-2 py-0.5 text-xs text-muted">{t('testimonials.hidden')}</span>}
                  {row.placements.length === 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">{t('testimonials.noPlacements')}</span>}
                  {row.placements.map((p) => (
                    <span key={p} className="rounded-full border border-taupe bg-sand px-2 py-0.5 text-xs text-ink">
                      {placementLabel.get(p) ?? p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
                <div className="flex">
                  <button type="button" disabled={pending || i === 0} onClick={() => move(row.id, -1)} aria-label={t('testimonials.moveUp')} className={buttonClass.ghost}>
                    <HiArrowUp aria-hidden />
                  </button>
                  <button type="button" disabled={pending || i === shown.length - 1} onClick={() => move(row.id, 1)} aria-label={t('testimonials.moveDown')} className={buttonClass.ghost}>
                    <HiArrowDown aria-hidden />
                  </button>
                </div>
                <button type="button" onClick={() => setEditing(row.id)} className={buttonClass.secondary}>
                  {t('common.edit')}
                </button>
                <button type="button" disabled={pending} onClick={() => remove(row)} className={buttonClass.ghost}>
                  {t('common.delete')}
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      {editing === 'new' ? (
        <TestimonialForm onDone={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={cn(buttonClass.primary, 'self-start')}>
          + {t('testimonials.add')}
        </button>
      )}
    </div>
  );
}
