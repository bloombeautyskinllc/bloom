'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveSettings, type SettingsInput } from '@/lib/admin/settings-actions';
import { cn } from '@/lib/utils';
import { Field, Notice, Panel, buttonClass, inputClass } from './ui';

type Values = Omit<SettingsInput, 'minorsAllowed' | 'paymentsEnabled' | 'paymentsMode'> & { minorsAllowed: boolean; paymentsEnabled: boolean; paymentsMode: 'sandbox' | 'production' };

// squareReady: which Square environments have credentials on this server
export default function SettingsForm({ initial, squareReady }: { initial: Values; squareReady: Record<Values['paymentsMode'], boolean> }) {
  const t = useTranslations('bo');
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const text = (key: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} htmlFor={`s-${key}`}>
      <input id={`s-${key}`} value={String(v[key] ?? '')} onChange={(e) => setV({ ...v, [key]: e.target.value })} className={inputClass} {...props} />
    </Field>
  );
  const check = (key: 'minorsAllowed' | 'paymentsEnabled', label: string) => (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.checked })} className="h-4 w-4 accent-cocoa" />
      {label}
    </label>
  );
  const num = { type: 'number', min: 0 } as const;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettings(v);
          if (r.ok) {
            setMessage({ tone: 'success', text: t('common.saved') });
            router.refresh();
          } else setMessage({ tone: 'error', text: r.error === 'invalid' ? `${t('common.error')} (${r.field})` : r.error === 'forbidden' ? t('common.forbidden') : r.error === 'payments_not_configured' ? t('settings.paymentsNotConfigured') : t('common.error') });
        });
      }}
    >
      <Panel title={t('settings.business')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('businessName', t('settings.businessName'), { required: true })}
          {text('legalName', t('settings.legalName'), { required: true })}
          {text('addressLine1', t('settings.address1'))}
          {text('addressLine2', t('settings.address2'))}
          {text('phone', t('settings.phone'), { placeholder: '+1…' })}
          {text('whatsapp', t('settings.whatsapp'), { placeholder: '+1…' })}
          {text('publicEmail', t('settings.publicEmail'), { type: 'email' })}
          {text('privacyEmail', t('settings.privacyEmail'), { type: 'email', required: true })}
        </div>
      </Panel>

      <Panel title={t('settings.booking')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('slotIntervalMin', t('settings.slotInterval'), { ...num, min: 5, step: 5 })}
          {text('minNoticeMin', t('settings.minNotice'), { ...num, step: 15 })}
          {text('maxWindowDays', t('settings.maxWindow'), { ...num, min: 1 })}
          {text('holdMinutes', t('settings.holdMinutes'), { ...num, min: 5, max: 60 })}
        </div>
      </Panel>

      <Panel title={t('settings.policy')}>
        <p className="mb-3 text-sm text-muted">{t('settings.termsNote')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {text('cancelCutoffHours', t('settings.cancelCutoff'), num)}
          {text('rescheduleCutoffHours', t('settings.rescheduleCutoff'), num)}
          {text('maxReschedules', t('settings.maxReschedules'), num)}
          {text('refundPercent', t('settings.refundPercent'), { ...num, max: 100 })}
          {text('lateRefundPercent', t('settings.lateRefundPercent'), { ...num, max: 100 })}
        </div>
        <div className="mt-3">{check('minorsAllowed', t('settings.minors'))}</div>
      </Panel>

      <Panel title={t('settings.notifications')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('reminderHours', t('settings.reminders'), { placeholder: '24, 2' })}
          {text('alertEmails', t('settings.alertEmails'))}
          {text('reviewUrl', t('settings.reviewUrl'), { type: 'url', placeholder: 'https://g.page/r/…/review' })}
          {text('reviewDelayHours', t('settings.reviewDelay'), num)}
        </div>
      </Panel>

      <Panel title={t('settings.payments')}>
        {check('paymentsEnabled', t('settings.paymentsEnabled'))}
        <p className="mt-2 text-xs text-muted">{t('settings.paymentsNote')}</p>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-ink">{t('settings.paymentsMode')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['sandbox', 'production'] as const).map((mode) => (
              <label
                key={mode}
                className={cn(
                  'flex cursor-pointer flex-col rounded-xl border px-4 py-2.5 text-sm transition',
                  v.paymentsMode === mode ? 'border-cocoa bg-white text-ink' : 'border-stone text-muted hover:border-taupe',
                )}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="paymentsMode" value={mode} checked={v.paymentsMode === mode} onChange={() => setV({ ...v, paymentsMode: mode })} className="h-4 w-4 accent-cocoa" />
                  {t(mode === 'sandbox' ? 'settings.modeSandbox' : 'settings.modeProduction')}
                </span>
                <span className={cn('mt-0.5 pl-6 text-xs', squareReady[mode] ? 'text-muted' : 'text-accent')}>
                  {t(squareReady[mode] ? 'settings.credentialsSet' : 'settings.credentialsMissing')}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t('settings.modeNote')}</p>
        </fieldset>
        <div className="mt-3 max-w-xs">{text('depositPercent', t('settings.depositPercent'), { ...num, max: 100 })}</div>
        <p className="mt-1 text-xs text-muted">{t('settings.depositNote')}</p>
      </Panel>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-stone bg-cream/95 p-3 shadow-soft backdrop-blur">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? t('common.saving') : t('common.save')}
        </button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </form>
  );
}
