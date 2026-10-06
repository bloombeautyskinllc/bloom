'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiOutlineDownload, HiOutlineExclamation } from 'react-icons/hi';
import DrawingPad from '@/components/consent/DrawingPad';
import FaceOutline from '@/components/consent/FaceOutline';
import { saveConsentRecord } from '@/lib/admin/consent-actions';
import { FACE_VIEWBOX } from '@/lib/consent/face-maps';
import { analysisFields, recordFields, type EstheticianRecord } from '@/lib/consent/form';
import { Field, Notice, buttonClass, inputClass } from './ui';

export type ConsentHighlights = {
  /** Health conditions checked by the client (labels) */
  conditions: string[];
  medication: string | null;
  allergies: string | null;
  avoid: string | null;
  pressure: string | null;
  photos: boolean;
};

type Props = {
  bookingId: string;
  signed: { signedName: string; signedAtLabel: string } | null;
  highlights: ConsentHighlights | null;
  record: EstheticianRecord;
  estheticianSignature: string | null;
  estheticianSignedLabel: string | null;
};

/** Consent status, PDF download, health flags and the esthetician part of the form. */
export default function ConsentPanel({ bookingId, signed, highlights, record: initial, estheticianSignature, estheticianSignedLabel }: Props) {
  const t = useTranslations('bo.consent');
  const tc = useTranslations('bo.common');
  const router = useRouter();
  const [record, setRecord] = useState(initial);
  const [signature, setSignature] = useState<string | null>(null);
  const [resign, setResign] = useState(!estheticianSignature);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!signed) return <p className="text-sm text-muted">{t('notSigned')}</p>;

  const setGroup = <K extends 'analysis' | 'record'>(group: K, id: string, v: string) => setRecord((r) => ({ ...r, [group]: { ...r[group], [id]: v } }));
  const face = (view: 'front' | 'profile') => (
    <div className="min-w-0 max-w-[220px] flex-1">
      <p className="mb-1.5 text-xs uppercase tracking-[0.12em] text-bronze">{t(view)}</p>
      <DrawingPad
        value={record.faceMaps[view]}
        onChange={(v) => setRecord((r) => ({ ...r, faceMaps: { ...r.faceMaps, [view]: v } }))}
        label={t('faceMap', { view: t(view) })}
        clearLabel={tc('clear')}
        background={<FaceOutline view={view} className="h-full w-full" />}
        aspectRatio={FACE_VIEWBOX.width / FACE_VIEWBOX.height}
        color="#9B3D2E"
        lineWidth={3}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink">
          <span className="mr-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900">{t('signed')}</span>
          {t('signedBy', { name: signed.signedName, date: signed.signedAtLabel })}
        </p>
        <a href={`/api/bookings/${bookingId}/consent`} className={buttonClass.secondary}>
          <HiOutlineDownload className="h-4 w-4" /> {t('download')}
        </a>
      </div>

      {highlights && (
        <dl className="grid gap-x-4 gap-y-2 rounded-xl bg-sand px-4 py-3 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="text-muted">{t('conditions')}</dt>
          <dd className={highlights.conditions.length ? 'flex items-start gap-1.5 font-medium text-red-900' : 'text-ink'}>
            {highlights.conditions.length > 0 && <HiOutlineExclamation className="mt-0.5 h-4 w-4 shrink-0" />}
            {highlights.conditions.length ? highlights.conditions.join(', ') : tc('none')}
          </dd>
          <dt className="text-muted">{t('medication')}</dt>
          <dd className="text-ink">{highlights.medication ?? tc('none')}</dd>
          <dt className="text-muted">{t('allergies')}</dt>
          <dd className="text-ink">{highlights.allergies ?? tc('none')}</dd>
          {highlights.avoid && (
            <>
              <dt className="text-muted">{t('avoid')}</dt>
              <dd className="text-ink">{highlights.avoid}</dd>
            </>
          )}
          {highlights.pressure && (
            <>
              <dt className="text-muted">{t('pressure')}</dt>
              <dd className="text-ink">{highlights.pressure}</dd>
            </>
          )}
          <dt className="text-muted">{t('photos')}</dt>
          <dd className="text-ink">{highlights.photos ? tc('yes') : tc('no')}</dd>
        </dl>
      )}

      <details className="group rounded-xl border border-stone bg-white/60" open={!estheticianSignature}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
          {t('estheticianTitle')}
          <span className="text-xs font-normal text-muted">{estheticianSignedLabel ? t('estheticianSigned', { date: estheticianSignedLabel }) : t('estheticianPending')}</span>
        </summary>
        <form
          className="flex flex-col gap-5 border-t border-stone px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(null);
            start(async () => {
              const result = await saveConsentRecord({ bookingId, record, signature: resign ? signature : null });
              if (!result.ok) return setNotice({ tone: 'error', text: t(`errors.${result.error}`) });
              setNotice({ tone: 'success', text: tc('saved') });
              if (resign && signature) setResign(false);
              setSignature(null);
              router.refresh();
            });
          }}
        >
          <div>
            <p className="mb-3 font-serif text-xl text-ink">{t('analysis')}</p>
            <div className="mb-4 flex gap-3 sm:gap-4">
              {face('front')}
              {face('profile')}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {analysisFields.map((f) => (
                <Field key={f.id} label={f.label} htmlFor={`an-${f.id}`}>
                  <input id={`an-${f.id}`} className={inputClass} maxLength={300} value={record.analysis[f.id]} onChange={(e) => setGroup('analysis', f.id, e.target.value)} />
                </Field>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 font-serif text-xl text-ink">{t('treatmentRecord')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {recordFields.map((f) => (
                <div key={f.id} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                  <Field label={f.label} htmlFor={`rec-${f.id}`}>
                    {f.type === 'textarea' ? (
                      <textarea id={`rec-${f.id}`} rows={2} maxLength={1000} className={`${inputClass} h-auto py-2`} value={record.record[f.id]} onChange={(e) => setGroup('record', f.id, e.target.value)} />
                    ) : (
                      <input id={`rec-${f.id}`} type={f.type} className={inputClass} maxLength={1000} value={record.record[f.id]} onChange={(e) => setGroup('record', f.id, e.target.value)} />
                    )}
                  </Field>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('estheticianName')} htmlFor="est-name">
              <input id="est-name" className={inputClass} maxLength={120} value={record.estheticianName} onChange={(e) => setRecord((r) => ({ ...r, estheticianName: e.target.value }))} />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">{t('estheticianSignature')}</p>
              {resign ? (
                <DrawingPad value={signature} onChange={setSignature} label={t('estheticianSignature')} clearLabel={tc('clear')} placeholder={t('signHere')} aspectRatio={5 / 2} />
              ) : (
                <div className="flex items-end justify-between gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={estheticianSignature!} alt={t('estheticianSignature')} className="h-16 max-w-[220px] rounded-lg border border-stone bg-white object-contain" />
                  <button type="button" onClick={() => setResign(true)} className={buttonClass.ghost}>
                    {t('signAgain')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <button type="submit" disabled={pending} className={`${buttonClass.primary} self-end`}>
            {pending ? tc('saving') : t('saveRecord')}
          </button>
        </form>
      </details>
    </div>
  );
}
