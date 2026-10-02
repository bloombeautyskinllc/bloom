import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { formatLegalDate } from '@/content/legal/format';
import { termsSections } from '@/content/legal/terms';
import { getPublicSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Terms of service | BLOOM Beauty Skin',
  description: 'Booking, payment, cancellation and rescheduling terms for BLOOM Beauty Skin.',
};

// Policy values (notice period, refunds, reschedules) come from business settings; refresh every 5 minutes
export const revalidate = 300;

export default async function TermsPage() {
  const settings = await getPublicSettings();
  return (
    <LegalPage
      lead="Terms of"
      accent="service."
      // terms_version is the effective date that clients accept during sign-up
      updated={formatLegalDate(settings.terms_version)}
      intro={
        <p>
          The essentials of booking with us: how appointments are confirmed, how payments and refunds work, and our
          cancellation and rescheduling policy.
        </p>
      }
      sections={termsSections(settings)}
    />
  );
}
