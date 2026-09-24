import { Link } from 'react-router-dom';
import { HiArrowUpRight } from 'react-icons/hi2';
import SectionLabel from '../ui/SectionLabel';
import Reveal from '../motion/Reveal';
import SplitText from '../motion/SplitText';
import GlowOrb from '../decor/GlowOrb';
import Sparkles from '../decor/Sparkles';
import { treatmentCategories } from '../../data/treatments';
import { routes } from '../../data/site';

const ease = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

export default function Treatments() {
  return (
    <section id="treatments" className="relative isolate overflow-hidden bg-cream py-20 sm:py-[120px]">
      <GlowOrb className="-left-48 -top-40 h-[640px] w-[640px]" />
      <GlowOrb className="-right-56 bottom-0 h-[560px] w-[560px]" color="rgba(228, 220, 210, 0.8)" delay={-8} />
      <Sparkles
        className="text-accent/50"
        items={[
          { top: '9%', left: '14%', size: 12, delay: 0.5 },
          { top: '14%', left: '84%', size: 16, delay: 2.2 },
          { top: '6%', left: '70%', size: 8, delay: 3.4 },
        ]}
      />

      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel lines="both">Our treatments</SectionLabel>
          <SplitText as="h2" delay={150} className="heading-lg mt-5 max-w-[640px]">
            Choose where to begin your <em>transformation.</em>
          </SplitText>
          <Reveal as="p" variant="blur" delay={500} className="mt-4 text-base text-muted sm:text-[17px]">
            Four specialties, one standard: results you can see and feel.
          </Reveal>
        </header>

        <ul className="mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[18px]">
          {treatmentCategories.map((t, i) => (
            <Reveal as="li" key={t.slug} delay={i * 130} duration={1300}>
              <Link
                to={routes.treatment(t.slug)}
                className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-[14px] p-6 text-cream sm:aspect-[4/5] lg:aspect-auto lg:h-[460px]"
              >
                <img
                  src={t.image}
                  alt=""
                  loading="lazy"
                  className={`absolute inset-0 -z-0 h-full w-full object-cover transition duration-[1400ms] ${ease} group-hover:scale-110`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-ink/5 transition-opacity duration-700 group-hover:opacity-90" />
                {/* Satin light sweeping across the card on hover */}
                <span aria-hidden className="sheen absolute inset-0 isolate overflow-hidden [--sheen:rgba(250,248,245,0.18)]" />
                <span
                  aria-hidden
                  className={`absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-cream/50 bg-cream/10 backdrop-blur-md transition duration-700 ${ease} group-hover:bg-cream group-hover:text-ink`}
                >
                  <HiArrowUpRight className={`h-4 w-4 transition-transform duration-700 ${ease} group-hover:rotate-45`} />
                </span>
                <div className="relative">
                  <span className="mb-3 block font-serif text-sm italic text-cream/70">0{i + 1}</span>
                  <h3 className="text-xl font-medium tracking-[-0.01em] sm:text-[22px]">{t.title}</h3>
                  <span
                    aria-hidden
                    className={`mt-3 block h-px w-10 bg-cream/60 transition-[width] duration-700 ${ease} group-hover:w-24`}
                  />
                  <p className={`mt-3 text-sm leading-relaxed text-cream/85 transition-transform duration-700 ${ease} group-hover:-translate-y-1`}>
                    {t.description}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={300} className="mt-10 flex justify-start sm:mt-16 sm:justify-center">
          <Link to={routes.booking} className="btn-dark">
            View the full treatment menu
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
