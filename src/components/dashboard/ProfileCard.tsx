'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import Card from '@/components/account/Card';
import { useCountryOptions } from '@/components/account/useCountryOptions';
import Modal from '@/components/ui/Modal';
import { signOut } from '@/lib/auth/actions';
import { deleteAccount, updateProfile, type ProfileFormState } from '@/lib/booking/actions';
import { cn } from '@/lib/utils';

type Props = { fullName: string; email: string | null; phoneE164: string | null; reminders: boolean };

const inputClass =
  'h-11 w-full rounded-xl border border-taupe bg-white px-3.5 text-[15px] text-ink transition focus:border-bronze focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-700';

function DeleteButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-full bg-red-900 px-5 py-3 text-sm font-medium text-cream disabled:opacity-60">
      {pending ? pendingLabel : label}
    </button>
  );
}

function ProfileForm({ props, onDone }: { props: Props; onDone: () => void }) {
  const t = useTranslations('dashboard');
  const to = useTranslations('onboarding');
  const countries = useCountryOptions();
  const phone = props.phoneE164 ? parsePhoneNumberFromString(props.phoneE164) : undefined;
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(async (prev, data) => {
    const result = await updateProfile(prev, data);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={action} noValidate className="mt-4 flex flex-col gap-4">
      <div>
        <label htmlFor="p-name" className="mb-1.5 block text-sm text-muted">
          {to('fullName')}
        </label>
        <input id="p-name" name="fullName" defaultValue={props.fullName} maxLength={120} aria-invalid={Boolean(state.errors?.fullName)} className={inputClass} />
        {state.errors?.fullName && <p className="mt-1 text-sm text-red-800">{to('errors.fullName')}</p>}
      </div>
      <fieldset>
        <legend className="mb-1.5 block text-sm text-muted">{to('phone')}</legend>
        <div className="flex gap-2">
          <select name="country" aria-label={to('country')} defaultValue={phone?.country ?? 'US'} className={cn(inputClass, 'w-[108px] shrink-0 px-2')}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input name="phone" type="tel" aria-label={to('phone')} defaultValue={phone?.formatNational() ?? ''} aria-invalid={Boolean(state.errors?.phone)} className={inputClass} />
        </div>
        {state.errors?.phone && <p className="mt-1 text-sm text-red-800">{to('errors.phone')}</p>}
      </fieldset>
      <label className="flex items-center gap-3 text-sm text-ink">
        <input type="checkbox" name="reminders" defaultChecked={props.reminders} className="h-5 w-5 rounded border-taupe accent-cocoa" />
        {to('reminders')}
      </label>
      {state.errors?.form && <p className="text-sm text-red-800">{to('errors.generic')}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-full bg-cocoa px-5 py-2.5 text-sm font-medium text-cream disabled:opacity-60">
          {pending ? t('saving') : t('save')}
        </button>
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2.5 text-sm text-muted hover:text-ink">
          {t('cancelEdit')}
        </button>
      </div>
    </form>
  );
}

export default function ProfileCard(props: Props) {
  const t = useTranslations('dashboard');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const phone = props.phoneE164 ? parsePhoneNumberFromString(props.phoneE164)?.formatInternational() : null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl text-ink">{t('profile')}</h2>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-sm text-bronze underline decoration-taupe underline-offset-4 hover:text-ink">
            {t('editProfile')}
          </button>
        )}
      </div>

      {editing ? (
        <ProfileForm props={props} onDone={() => setEditing(false)} />
      ) : (
        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-muted">{t('email')}</dt>
            <dd className="break-all text-ink">{props.email}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('phone')}</dt>
            <dd className="text-ink">{phone}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('reminders')}</dt>
            <dd className="text-ink">{props.reminders ? t('remindersOn') : t('remindersOff')}</dd>
          </div>
        </dl>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stone pt-4">
        <form action={signOut}>
          <button type="submit" className="text-sm text-bronze underline decoration-taupe underline-offset-4 hover:text-ink">
            {t('signOut')}
          </button>
        </form>
        <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-muted hover:text-red-800">
          {t('deleteAccount.title')}
        </button>
      </div>

      <Modal open={confirmDelete} onOpenChange={setConfirmDelete} title={t('deleteAccount.title')} description={t('deleteAccount.body')}>
        <form action={deleteAccount} className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full border border-taupe px-5 py-3 text-sm font-medium text-ink">
            {t('deleteAccount.keep')}
          </button>
          <DeleteButton label={t('deleteAccount.confirm')} pendingLabel={t('deleteAccount.deleting')} />
        </form>
      </Modal>
    </Card>
  );
}
