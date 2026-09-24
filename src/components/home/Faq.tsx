import { useId, useState } from 'react';
import SectionLabel from '../ui/SectionLabel';
import Flower from '../ui/Flower';
import Reveal from '../motion/Reveal';
import SplitText from '../motion/SplitText';
import GlowOrb from '../decor/GlowOrb';
import Sparkles from '../decor/Sparkles';
import { faqs } from '../../data/faqs';
import { site } from '../../data/site';

const ease = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" className="relative isolate overflow-hidden bg-gradient-to-b from-stone to-taupe py-20 sm:py-[100px]">
      <GlowOrb className="-left-32 bottom-[-10%] h-[520px] w-[520px]" color="rgba(250, 248, 245, 0.6)" delay={-4} />
      {/* Oversized petal turning quietly behind the intro column */}
      <Flower className="absolute -left-24 top-1/2 -z-10 hidden h-[420px] w-[420px] opacity-40 lg:block" />

      <div className="container-site grid gap-10 lg:grid-cols-[1fr_756px] lg:gap-16">
        <div className="relative">
          <SectionLabel>FAQ</SectionLabel>
          <SplitText as="h2" delay={150} className="heading-lg mt-5">
            Frequently asked <em>questions.</em>
          </SplitText>
          <Reveal as="p" variant="blur" delay={450} className="mt-5 max-w-[327px] text-base leading-relaxed text-muted">
            Still unsure?{' '}
            <a
              href={site.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-bronze/40 underline-offset-4 transition hover:text-ink hover:decoration-ink"
            >
              Message us on WhatsApp
            </a>{' '}
            and a specialist will help you choose.
          </Reveal>
          <Sparkles
            className="hidden text-bronze/50 lg:block"
            items={[
              { top: '105%', left: '8%', size: 14, delay: 0.2 },
              { top: '125%', left: '40%', size: 9, delay: 1.7 },
            ]}
          />
        </div>

        <ul className="divide-y divide-bronze/20 border-y border-bronze/20 lg:border-t-0">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            const panelId = `${baseId}-panel-${i}`;
            return (
              <Reveal as="li" key={f.question} delay={Math.min(i, 6) * 90}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="group flex w-full items-center justify-between gap-6 py-6 text-left text-base text-ink sm:text-[17px]"
                  >
                    <span className={`transition-transform duration-500 ${ease} group-hover:translate-x-1.5`}>{f.question}</span>
                    <span
                      aria-hidden
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-lg transition duration-500 ${ease} ${
                        isOpen ? 'rotate-45 border-cocoa bg-cocoa text-cream' : 'border-bronze/35 group-hover:border-cocoa group-hover:bg-cream/60'
                      }`}
                    >
                      +
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  className={`grid transition-[grid-template-rows] duration-500 ${ease} ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p
                      className={`max-w-[560px] pb-6 text-[15px] leading-relaxed text-muted transition-[opacity,transform] duration-500 ${ease} ${
                        isOpen ? 'translate-y-0 opacity-100 delay-100' : '-translate-y-2 opacity-0'
                      }`}
                    >
                      {f.answer}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
