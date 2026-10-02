import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY_UPDATED, privacySections } from '@/content/legal/privacy';
import { routes } from '@/data/site';
import { formatLegalDate } from '@/content/legal/format';
import { getPublicSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Privacy policy | BLOOM Beauty Skin',
  description: 'How BLOOM Beauty Skin collects, uses and protects your personal information.',
};

// Policy values come from business settings; refresh the static page every 5 minutes
export const revalidate = 300;

export default async function PrivacyPage() {
  const settings = await getPublicSettings();
  return (
    <LegalPage
      lead="Privacy"
      accent="policy."
      updated={formatLegalDate(PRIVACY_UPDATED)}
      intro={
        <p>
          Your privacy matters as much as your skin. This policy explains, in plain language, what we collect, why, and
          how you stay in control. It works together with our <Link href={routes.terms}>Terms of service</Link>.
        </p>
      }
      sections={privacySections(settings)}
    />
  );
}
