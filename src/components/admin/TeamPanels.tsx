'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiX } from 'react-icons/hi';
import { addBlock, findPersonByEmail, removeBlock, saveSpecialist, saveWorkingHours, setRole } from '@/lib/admin/team-actions';
import { addDays } from '@/lib/availability/timezone';
import LocalDateTimeInput, { toInstant } from './LocalDateTimeInput';
import { Field, Notice, buttonClass, inputClass } from './ui';

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

// -----------------------------------------------------------------------------
// Specialists
// -----------------------------------------------------------------------------
export type SpecialistRow = { id: string; displayName: string; bio: string | null; color: string | null; isActive: boolean; treatmentIds: string[] };

export function SpecialistEditor({ specialist, treatments }: { specialist?: SpecialistRow; treatments: { id: string; name: string; category: string }[] }) {
  const t = useTranslations('bo');
  const { pending, message, run } = useAction();
  const [f, setF] = useState({
    displayName: specialist?.displayName ?? '',
    bio: specialist?.bio ?? '',
    color: specialist?.color ?? '#725F4C',
    isActive: specialist?.isActive ?? true,
    treatmentIds: specialist?.treatmentIds ?? treatments.map((x) => x.id),
  });
  const categories = [...new Set(treatments.map((x) => x.category))];
  const id = specialist?.id ?? 'new';

  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-sand/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveSpecialist({ id: specialist?.id, ...f }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Field label={t('team.displayName')} htmlFor={`${id}-name`}>
          <input id={`${id}-name`} required value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} className={inputClass} />
        </Field>
        <Field label={t('team.color')} htmlFor={`${id}-color`}>
          <input id={`${id}-color`} type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-taupe" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="h-4 w-4 accent-cocoa" />
          {t('common.active')}
        </label>
      </div>
      <Field label={t('team.bio')} htmlFor={`${id}-bio`}>
        <textarea id={`${id}-bio`} rows={2} maxLength={600} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} className={`${inputClass} h-auto py-2`} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">{t('team.treatments')}</legend>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <div key={c}>
              <p className="mb-1 mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-bronze">{c}</p>
              {treatments
                .filter((x) => x.category === c)
                .map((x) => (
                  <label key={x.id} className="flex items-center gap-2 py-0.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={f.treatmentIds.includes(x.id)}
                      onChange={() => setF({ ...f, treatmentIds: f.treatmentIds.includes(x.id) ? f.treatmentIds.filter((y) => y !== x.id) : [...f.treatmentIds, x.id] })}
                      className="h-4 w-4 accent-cocoa"
                    />
                    {x.name}
                  </label>
                ))}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? t('common.saving') : t('common.save')}
        </button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Weekly hours
// -----------------------------------------------------------------------------
type Window = { isoWeekday: number; start: string; end: string };

export function HoursEditor({ specialistId, initial }: { specialistId: string | null; initial: Window[] }) {
  const t = useTranslations('bo');
  const days = t.raw('team.weekdays') as string[];
  const { pending, message, run } = useAction();
  const [hours, setHours] = useState<Window[]>(initial);

  const update = (i: number, patch: Partial<Window>) => setHours((h) => h.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  return (
    <div className="flex flex-col gap-2">
      {days.map((label, d) => {
        const weekday = d + 1;
        const windows = hours.map((w, i) => ({ w, i })).filter(({ w }) => w.isoWeekday === weekday);
        return (
          <div key={weekday} className="grid items-center gap-2 border-b border-stone py-2 sm:grid-cols-[120px_1fr]">
            <span className="text-sm font-medium text-ink">{label}</span>
            <div className="flex flex-wrap items-center gap-2">
              {windows.length === 0 && <span className="text-sm text-muted">{t('team.closed')}</span>}
              {windows.map(({ w, i }) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-xl bg-sand px-2 py-1">
                  <input type="time" step={900} value={w.start} onChange={(e) => update(i, { start: e.target.value })} aria-label={`${label} ${t('team.start')}`} className="rounded-md border border-taupe bg-white px-1.5 py-1 text-sm" />
                  –
                  <input type="time" step={900} value={w.end} onChange={(e) => update(i, { end: e.target.value })} aria-label={`${label} ${t('team.end')}`} className="rounded-md border border-taupe bg-white px-1.5 py-1 text-sm" />
                  <button type="button" onClick={() => setHours((h) => h.filter((_, j) => j !== i))} aria-label={t('common.delete')} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-stone">
                    <HiX className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <button type="button" className={`${buttonClass.ghost} px-2 py-1 text-xs`} onClick={() => setHours((h) => [...h, { isoWeekday: weekday, start: '10:00', end: '20:00' }])}>
                + {t('team.addWindow')}
              </button>
            </div>
          </div>
        );
      })}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} className={buttonClass.primary} onClick={() => run(() => saveWorkingHours({ specialistId, hours }))}>
          {pending ? t('common.saving') : t('common.save')}
        </button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Blocks and time off
// -----------------------------------------------------------------------------
export type BlockRow = { id: string; label: string; source: string; reason: string | null; appliesTo: string };

export function BlocksEditor({ blocks, specialists, timeZone, today }: { blocks: BlockRow[]; specialists: { id: string; name: string }[]; timeZone: string; today: string }) {
  const t = useTranslations('bo');
  const { pending, message, run } = useAction();
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState({ date: today, time: '10:00' });
  const [to, setTo] = useState({ date: today, time: '20:00' });
  const [specialistId, setSpecialistId] = useState('');
  const [reason, setReason] = useState('');

  const create = () => {
    // Whole days run from local midnight to the midnight after the last day
    const start = allDay ? toInstant(from.date, '00:00', timeZone) : toInstant(from.date, from.time, timeZone);
    const end = allDay ? toInstant(addDays(to.date, 1), '00:00', timeZone) : toInstant(to.date, to.time, timeZone);
    if (!start || !end) return;
    run(() => addBlock({ start, end, specialistId: specialistId || null, reason }), () => setReason(''));
  };

  return (
    <div className="flex flex-col gap-4">
      {blocks.length === 0 ? (
        <p className="text-sm text-muted">{t('team.noBlocks')}</p>
      ) : (
        <ul className="divide-y divide-stone text-sm">
          {blocks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="block text-ink">{b.label}</span>
                <span className="text-xs text-muted">
                  {b.reason ?? '—'} · {b.appliesTo}
                  {b.source === 'google' && ` · ${t('team.fromGoogle')}`}
                </span>
              </span>
              {b.source !== 'google' && (
                <button type="button" disabled={pending} className={buttonClass.ghost} onClick={() => run(() => removeBlock(b.id))}>
                  {t('common.delete')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-taupe p-4">
        <p className="text-sm font-medium text-ink">{t('team.addBlock')}</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-cocoa" />
          {t('team.allDay')}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {allDay ? (
            <>
              <Field label={t('team.start')} htmlFor="blk-from">
                <input id="blk-from" type="date" value={from.date} onChange={(e) => setFrom({ ...from, date: e.target.value })} className={inputClass} />
              </Field>
              <Field label={t('team.end')} htmlFor="blk-to">
                <input id="blk-to" type="date" value={to.date} onChange={(e) => setTo({ ...to, date: e.target.value })} className={inputClass} />
              </Field>
            </>
          ) : (
            <>
              <div>
                <p className="mb-1 text-sm font-medium text-ink">{t('team.start')}</p>
                <LocalDateTimeInput idPrefix="blk-s" date={from.date} time={from.time} onChange={setFrom} />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-ink">{t('team.end')}</p>
                <LocalDateTimeInput idPrefix="blk-e" date={to.date} time={to.time} onChange={setTo} />
              </div>
            </>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('common.reason')} htmlFor="blk-reason">
            <input id="blk-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} />
          </Field>
          {specialists.length > 1 && (
            <Field label={t('team.appliesTo')} htmlFor="blk-who">
              <select id="blk-who" value={specialistId} onChange={(e) => setSpecialistId(e.target.value)} className={inputClass}>
                <option value="">{t('team.everyone')}</option>
                {specialists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} className={buttonClass.primary} onClick={create}>
            {t('team.addBlock')}
          </button>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Back office access
// -----------------------------------------------------------------------------
export type StaffRow = { id: string; name: string | null; email: string | null; role: 'staff' | 'admin' };

export function StaffAccess({ people, meId }: { people: StaffRow[]; meId: string }) {
  const t = useTranslations('bo');
  const { pending, message, run, setMessage } = useAction();
  const [email, setEmail] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-stone text-sm">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="block text-ink">{p.name ?? p.email}</span>
              <span className="text-xs text-muted">
                {p.email} · {t(`nav.role.${p.role}`)}
              </span>
            </span>
            {p.id !== meId && (
              <span className="flex gap-1.5">
                {p.role === 'staff' ? (
                  <button type="button" disabled={pending} className={`${buttonClass.secondary} px-3 py-1.5 text-xs`} onClick={() => run(() => setRole({ profileId: p.id, role: 'admin' }))}>
                    {t('team.makeAdmin')}
                  </button>
                ) : (
                  <button type="button" disabled={pending} className={`${buttonClass.secondary} px-3 py-1.5 text-xs`} onClick={() => run(() => setRole({ profileId: p.id, role: 'staff' }))}>
                    {t('team.makeStaff')}
                  </button>
                )}
                <button type="button" disabled={pending} className={`${buttonClass.ghost} px-3 py-1.5 text-xs`} onClick={() => run(() => setRole({ profileId: p.id, role: 'client' }))}>
                  {t('team.makeClient')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const person = await findPersonByEmail(email);
            if (!person) {
              setMessage({ tone: 'error', text: t('errors.not_found') });
              return { ok: false, error: 'not_found' };
            }
            const r = await setRole({ profileId: person.id, role: 'staff' });
            if (r.ok) setEmail('');
            return r;
          });
        }}
      >
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('team.findUser')} aria-label={t('team.findUser')} className={`${inputClass} max-w-sm`} />
        <button type="submit" disabled={pending || !email} className={buttonClass.secondary}>
          {t('team.makeStaff')}
        </button>
      </form>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  );
}
