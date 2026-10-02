'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiOutlineDocumentText, HiX } from 'react-icons/hi';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { documentLink, setClientTag, toggleClientNotePin, updateClient, uploadClientDocument } from '@/lib/admin/actions';
import { Field, Notice, buttonClass, inputClass } from './ui';

// -----------------------------------------------------------------------------
// Contact details
// -----------------------------------------------------------------------------
export function ClientEditor({ client }: { client: { id: string; fullName: string; email: string | null; phone: string | null; hasLogin: boolean } }) {
  const t = useTranslations('bo');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: client.fullName, email: client.email ?? '', phone: client.phone ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <button type="button" className={buttonClass.secondary} onClick={() => setEditing(true)}>
        {t('client.edit')}
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const phone = form.phone ? parsePhoneNumberFromString(form.phone, 'US') : undefined;
        if (form.phone && !phone?.isValid()) return setError(t('errors.generic'));
        start(async () => {
          const result = await updateClient({ clientId: client.id, fullName: form.fullName, email: client.hasLogin ? undefined : form.email, phoneE164: phone?.number ?? '' });
          if (!result.ok) return setError(t(`errors.${result.error}`));
          setEditing(false);
          router.refresh();
        });
      }}
    >
      <Field label={t('newBooking.fullName')} htmlFor="ce-name">
        <input id="ce-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
      </Field>
      <Field label={t('client.email')} htmlFor="ce-email" hint={client.hasLogin ? t('client.hasLogin') : undefined}>
        <input id="ce-email" type="email" disabled={client.hasLogin} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
      </Field>
      <Field label={t('client.phone')} htmlFor="ce-phone">
        <input id="ce-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" className={buttonClass.ghost} onClick={() => setEditing(false)}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Tags
// -----------------------------------------------------------------------------
export function TagEditor({ clientId, tags, allTags }: { clientId: string; tags: string[]; allTags: string[] }) {
  const t = useTranslations('bo.client');
  const router = useRouter();
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const set = (tagName: string, on: boolean) =>
    start(async () => {
      await setClientTag({ clientId, tagName, on });
      setValue('');
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs text-bronze">
            {tag}
            <button type="button" disabled={pending} onClick={() => set(tag, false)} aria-label={`Remove ${tag}`} className="rounded-full hover:text-ink">
              <HiX className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) set(value, true);
        }}
      >
        <input list="all-tags" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('newTag')} aria-label={t('addTag')} maxLength={40} className={inputClass} />
        <datalist id="all-tags">
          {allTags.filter((x) => !tags.includes(x)).map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <button type="submit" disabled={pending || !value.trim()} className={buttonClass.secondary}>
          {t('addTag')}
        </button>
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Pin a note
// -----------------------------------------------------------------------------
export function PinButton({ noteId, clientId, pinned }: { noteId: string; clientId: string; pinned: boolean }) {
  const t = useTranslations('bo.client');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-bronze hover:underline"
      onClick={() =>
        start(async () => {
          await toggleClientNotePin({ noteId, clientId, pinned: !pinned });
          router.refresh();
        })
      }
    >
      {pinned ? t('unpin') : t('pin')}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Documents: private bucket, signed links, every access audited
// -----------------------------------------------------------------------------
type Doc = { id: string; title: string; kind: string; dateLabel: string };

export function Documents({ clientId, documents }: { clientId: string; documents: Doc[] }) {
  const t = useTranslations('bo.client');
  const tc = useTranslations('bo.common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {documents.length === 0 ? (
        <p className="text-sm text-muted">{t('noDocuments')}</p>
      ) : (
        <ul className="divide-y divide-stone text-sm">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <HiOutlineDocumentText className="h-5 w-5 shrink-0 text-bronze" />
                <span className="min-w-0">
                  <span className="block truncate text-ink">{d.title}</span>
                  <span className="text-xs text-muted">
                    {t(`kinds.${d.kind}`)} · {d.dateLabel}
                  </span>
                </span>
              </span>
              <button
                type="button"
                className={buttonClass.ghost}
                onClick={async () => {
                  const result = await documentLink(d.id);
                  if (result.ok) window.open(result.data.url, '_blank', 'noopener');
                  else setError(tc('error'));
                }}
              >
                {t('open')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-2 rounded-xl border border-dashed border-taupe p-3 sm:grid-cols-[1fr_140px]"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          data.set('clientId', clientId);
          start(async () => {
            const result = await uploadClientDocument(data);
            if (!result.ok) return setError(tc('error'));
            form.reset();
            setError(null);
            router.refresh();
          });
        }}
      >
        <input name="title" placeholder={t('documentTitle')} aria-label={t('documentTitle')} maxLength={200} className={inputClass} />
        <select name="kind" defaultValue="consent" aria-label={t('documentKind')} className={inputClass}>
          {(['consent', 'intake', 'photo', 'other'] as const).map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
        <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" aria-label={t('file')} className="text-sm sm:col-span-2" />
        <button type="submit" disabled={pending} className={`${buttonClass.secondary} sm:col-span-2 sm:justify-self-start`}>
          {pending ? t('uploading') : t('upload')}
        </button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      <p className="text-xs text-muted">{t('privacyNote')}</p>
    </div>
  );
}
