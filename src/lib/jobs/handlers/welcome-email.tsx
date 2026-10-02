import 'server-only';
import { createTranslator } from 'next-intl';
import { z } from 'zod';
import { routes, site } from '@/data/site';
import { logoAttachment } from '@/emails/EmailLayout';
import WelcomeEmail from '@/emails/WelcomeEmail';
import { defaultLocale, loadMessages, locales, type Locale } from '@/i18n/config';
import { env } from '@/lib/env';
import { firstName } from '@/lib/format/name';
import { sendEmail } from '@/lib/notifications/email';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Job } from '../types';

const payloadSchema = z.object({ profile_id: z.uuid() });

export async function welcomeEmail(job: Job) {
  const { profile_id } = payloadSchema.parse(job.payload);

  const { data: profile, error } = await createAdminClient()
    .from('profiles')
    .select('id, email, full_name, locale, anonymized_at, deleted_at')
    .eq('id', profile_id)
    .single();
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  // Nothing to send (no address or the account is gone): the job still succeeds
  if (!profile.email || profile.anonymized_at || profile.deleted_at) return;

  const locale: Locale = locales.includes(profile.locale as Locale) ? (profile.locale as Locale) : defaultLocale;
  const t = createTranslator({ locale, messages: await loadMessages(locale), namespace: 'email.welcome' });
  const name = firstName(profile.full_name);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;

  await sendEmail({
    to: profile.email,
    subject: t('subject'),
    template: 'welcome',
    profileId: profile.id,
    jobId: job.id,
    idempotencyKey: `welcome/${profile.id}`,
    attachments: [logoAttachment],
    react: (
      <WelcomeEmail
        siteUrl={siteUrl}
        bookingUrl={`${siteUrl}${routes.booking}`}
        address={`${site.address.line1}, ${site.address.line2}`}
        copy={{
          preview: t('preview'),
          heading: t('heading', { name }),
          body: t('body'),
          cta: t('cta'),
          signoff: t('signoff'),
          team: t('team'),
          footer: t('footer'),
        }}
      />
    ),
  });
}
