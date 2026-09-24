import { useId, useState } from 'react';
import SectionLabel from '../ui/SectionLabel';
import { faqs } from '../../data/faqs';
import { site } from '../../data/site';

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" className="bg-gradient-to-b from-stone to-taupe py-20 sm:py-[100px]">
      <div className="container-site grid gap-10 lg:grid-cols-[1fr_756px] lg:gap-16">
        <div>
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="heading-lg mt-5">
            Frequently asked <em>questions.</em>
          </h2>
          <p className="mt-5 max-w-[327px] text-base leading-relaxed text-muted">
            Still unsure?{' '}
            <a href={site.whatsappUrl} target="_blank" rel="noreferrer" className="underline decoration-bronze/40 underline-offset-4 transition hover:text-ink">
              Message us on WhatsApp
            </a>{' '}
            and a specialist will help you choose.
          </p>
        </div>

        <ul className="divide-y divide-bronze/20 border-y border-bronze/20 lg:border-t-0">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            const panelId = `${baseId}-panel-${i}`;
            return (
              <li key={f.question}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-base text-ink sm:text-[17px]"
                  >
                    {f.question}
                    <span
                      aria-hidden
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-bronze/35 text-lg transition-transform duration-300 ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                    >
                      +
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[560px] pb-6 text-[15px] leading-relaxed text-muted">{f.answer}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
