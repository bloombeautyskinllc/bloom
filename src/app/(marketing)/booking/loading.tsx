import { getTranslations } from 'next-intl/server';
import GlowOrb from '@/components/decor/GlowOrb';
import SectionLabel from '@/components/ui/SectionLabel';

// Shown as soon as "Book now" is clicked (and prefetched with the link) while the page checks the
// session and loads the catalog. Same shell as the page so nothing jumps when it arrives.
export default async function BookingLoading() {
  const t = await getTranslations('booking');
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-cream via-cream to-sand pb-24 pt-32 sm:pt-40">
      <GlowOrb className="-left-40 top-10 h-[560px] w-[560px]" />
      <div className="container-site">
        <SectionLabel>{t('label')}</SectionLabel>
        <h1 className="heading-lg mt-5">
          {t('titleLead')} <em>{t('titleAccent')}</em>
        </h1>
        <div className="mt-10" aria-busy="true">
          <div className="h-9 w-64 animate-pulse rounded-full bg-stone/60" />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 rounded-[20px] border border-stone bg-white/70 p-3">
                <span className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-stone/60" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="h-5 w-2/3 animate-pulse rounded-full bg-stone/60" />
                  <span className="h-4 w-1/3 animate-pulse rounded-full bg-stone/40" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
