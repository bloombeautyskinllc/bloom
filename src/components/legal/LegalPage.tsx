import type { ReactNode } from 'react';
import GlowOrb from '../decor/GlowOrb';
import SectionLabel from '../ui/SectionLabel';

export type LegalSection = { id: string; title: string; body: ReactNode };

type Props = {
  lead: string;
  accent: string;
  intro: ReactNode;
  updated: string;
  sections: LegalSection[];
};

function TableOfContents({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="mt-4 flex flex-col gap-2.5 border-l border-stone pl-4 text-sm">
      {sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="text-muted transition hover:text-ink">
            {i + 1}. {s.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

// Long-form legal document: same backdrop and heading style as the site, with a sticky table of contents
export default function LegalPage({ lead, accent, intro, updated, sections }: Props) {
  // overflow-clip, not overflow-hidden: hidden would become the sticky table of contents' scroll container
  return (
    <section className="relative isolate overflow-clip bg-gradient-to-b from-cream via-cream to-sand pb-24 pt-32 sm:pt-44">
      <GlowOrb className="-left-40 top-10 h-[560px] w-[560px]" />
      <GlowOrb className="-right-48 top-[40%] h-[520px] w-[520px]" color="rgba(205, 194, 180, 0.5)" delay={-7} />

      <div className="container-site">
        <header className="max-w-[720px]">
          <SectionLabel>Legal</SectionLabel>
          <h1 className="heading-lg mt-5">
            {lead} <em>{accent}</em>
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.12em] text-bronze">Last updated {updated}</p>
          <div className="legal-prose mt-6 !text-base">{intro}</div>
        </header>

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[240px_1fr] lg:gap-16">
          {/* Collapsible on phones so the document starts right away; sticky sidebar from lg up */}
          <details className="group rounded-2xl border border-stone bg-cream/70 px-5 py-4 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">
              On this page
              <span aria-hidden className="text-base transition group-open:rotate-45">+</span>
            </summary>
            <TableOfContents sections={sections} />
          </details>
          <nav aria-label="On this page" className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">On this page</p>
            <TableOfContents sections={sections} />
          </nav>

          <article className="max-w-[720px] rounded-[22px] border border-stone bg-cream/80 px-6 py-8 shadow-soft sm:px-10 sm:py-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="border-b border-stone pb-9 pt-9 first:pt-0 last:border-b-0 last:pb-0">
                <h2 className="font-serif text-[26px] leading-tight text-ink sm:text-[30px]">
                  <span className="mr-2 text-bronze">{i + 1}.</span>
                  {s.title}
                </h2>
                <div className="legal-prose mt-4">{s.body}</div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </section>
  );
}
