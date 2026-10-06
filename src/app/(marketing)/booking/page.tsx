import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import BookingFlow from '@/components/booking/BookingFlow';
import QueryProvider from '@/components/booking/QueryProvider';
import GlowOrb from '@/components/decor/GlowOrb';
import SectionLabel from '@/components/ui/SectionLabel';
import { routes } from '@/data/site';
import { requireOnboardedProfile } from '@/lib/auth/session';
import { getBookingCatalog } from '@/lib/booking/catalog';
import { formatDateLong } from '@/lib/booking/format';
import { formatPhone } from '@/lib/format/phone';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('booking');
  return { title: t('metaTitle'), robots: { index: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Booking needs a signed-in, onboarded client. ?category= / ?treatment= / ?options= carry the
// booking intent from treatment pages and survive the sign-in round trip.
export default async function BookingPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === 'string') params.set(key, value);
  // The guard and the data load run side by side: none of these queries depends on another
  const [{ profile, previousConsent }, catalog, settings, t] = await Promise.all([
    requireOnboardedProfile(params.size ? `${routes.booking}?${params.toString()}` : routes.booking).then(async ({ profile }) => {
      // The latest signed form prefills this booking's form
      const { data } = await (await createClient())
        .from('consent_forms')
        .select('answers, signed_at')
        .eq('client_id', profile.id)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { profile, previousConsent: data };
    }),
    getBookingCatalog(),
    getPublicSettings(),
    getTranslations('booking'),
  ]);

  const treatment = catalog.categories.flatMap((c) => c.treatments).find((x) => x.slug === params.get('treatment')) ?? null;
  const optionSlugs = params.get('options')?.split(',') ?? [];
  const initial = {
    categorySlug: treatment?.categorySlug ?? catalog.categories.find((c) => c.slug === params.get('category'))?.slug ?? null,
    treatmentId: treatment?.id ?? null,
    optionIds: treatment ? treatment.options.filter((o) => optionSlugs.includes(o.slug)).map((o) => o.id) : [],
  };

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-cream via-cream to-sand pb-24 pt-32 sm:pt-40">
      <GlowOrb className="-left-40 top-10 h-[560px] w-[560px]" />
      <div className="container-site">
        <SectionLabel>{t('label')}</SectionLabel>
        <h1 className="heading-lg mt-5">
          {t('titleLead')} <em>{t('titleAccent')}</em>
        </h1>
        <div className="mt-10">
          <QueryProvider>
            <BookingFlow
              catalog={catalog}
              timeZone={settings.timezone}
              maxWindowDays={settings.max_window_days}
              policy={{
                cancelCutoffHours: settings.cancel_cutoff_hours,
                maxReschedules: settings.max_reschedules,
                refundPercent: settings.cancellation_refund_percent,
                paymentsEnabled: settings.payments_enabled,
                depositPercent: settings.deposit_percent,
              }}
              initial={initial}
              consent={{
                previousAnswers: previousConsent?.answers ?? null,
                previousSignedOn: previousConsent ? formatDateLong(previousConsent.signed_at, settings.timezone) : null,
                profile: { fullName: profile.full_name, email: profile.email, phone: formatPhone(profile.phone_e164) },
              }}
            />
          </QueryProvider>
        </div>
      </div>
    </section>
  );
}
