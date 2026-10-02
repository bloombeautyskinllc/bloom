import type { ReactNode } from 'react';
import GlowOrb from '../decor/GlowOrb';
import SectionLabel from '../ui/SectionLabel';

type Props = { label: string; lead: string; accent: string; intro?: ReactNode; children: ReactNode; wide?: boolean };

// Shared frame for account pages: same backdrop, container, label and "<lead> <em>accent</em>" heading as the
// booking and legal pages. `wide` spans the full site container; otherwise the content stays a narrow column.
export default function AccountSection({ label, lead, accent, intro, children, wide = false }: Props) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-cream via-cream to-sand pb-24 pt-32 sm:pt-40">
      <GlowOrb className="-left-40 top-10 h-[560px] w-[560px]" />
      <GlowOrb className="-right-48 top-[40%] h-[520px] w-[520px]" color="rgba(205, 194, 180, 0.5)" delay={-7} />
      <div className="container-site">
        <div className={wide ? undefined : 'max-w-[560px]'}>
          <SectionLabel>{label}</SectionLabel>
          <h1 className="heading-lg mt-5">
            {lead} <em>{accent}</em>
          </h1>
          {intro && <p className="mt-4 max-w-[720px] text-base leading-relaxed text-muted">{intro}</p>}
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </section>
  );
}
