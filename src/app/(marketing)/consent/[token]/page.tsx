import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ConsentLinkForm from '@/components/booking/ConsentLinkForm';
import GlowOrb from '@/components/decor/GlowOrb';
import SectionLabel from '@/components/ui/SectionLabel';
import { formatDateLong, formatTime } from '@/lib/booking/format';
import { getContact } from '@/lib/contact';
import { prefillAnswers } from '@/lib/consent/form';
import { consentTokenSchema } from '@/lib/consent/link';
import { formatPhone } from '@/lib/format/phone';
import { getPublicSettings } from '@/lib/settings';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('consentLink');
  // The token is the access to the form: keep it out of search engines and referrers
  return { title: t('metaTitle'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

// Intake & consent form opened from a link the studio sent (staff bookings): no sign-in needed
export default async function ConsentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = consentTokenSchema.safeParse(token).success;
  const [t, settings, contact, { data }] = await Promise.all([
    getTranslations('consentLink'),
    getPublicSettings(),
    getContact(),
    valid ? createPublicClient().rpc('consent_link_booking', { p_token: token }) : Promise.resolve({ data: null }),
  ]);
  const booking = data?.[0];
  const tz = settings.timezone;

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-cream via-cream to-sand pb-24 pt-32 sm:pt-40">
      <GlowOrb className="-left-40 top-10 h-[560px] w-[560px]" />
      <div className="container-site">
        <SectionLabel>{t('label')}</SectionLabel>
        <h1 className="heading-lg mt-5">
          {t('titleLead')} <em>{t('titleAccent')}</em>
        </h1>
        {!booking ? (
          <div className="mt-10 rounded-2xl border border-stone bg-white/70 px-6 py-6">
            <p className="font-serif text-2xl text-ink">{t('invalidTitle')}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('invalidBody')}</p>
            {(contact.phone || contact.email) && <p className="mt-3 text-sm text-ink">{[contact.phone, contact.email].filter(Boolean).join(' · ')}</p>}
          </div>
        ) : (
          <>
            <p className="mt-6 text-base leading-relaxed text-muted">
              {t('intro', {
                treatment: booking.treatment ?? t('appointment'),
                date: `${formatDateLong(booking.start_at, tz)} · ${formatTime(booking.start_at, tz)}`,
              })}
            </p>
            <div className="mt-10">
              <ConsentLinkForm
                token={token}
                initialAnswers={prefillAnswers(null, { fullName: booking.full_name, email: booking.email, phone: formatPhone(booking.phone_e164) }, booking.treatment)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
