import type { ElementType } from 'react';
import { Link, useParams } from 'react-router-dom';
import SectionLabel from '../components/ui/SectionLabel';
import Flower from '../components/ui/Flower';
import Testimonials from '../components/home/Testimonials';
import Reveal from '../components/motion/Reveal';
import SplitText from '../components/motion/SplitText';
import ParallaxImage from '../components/motion/ParallaxImage';
import GlowOrb from '../components/decor/GlowOrb';
import Sparkles from '../components/decor/Sparkles';
import ComingSoon from './ComingSoon';
import logoMark from '../assets/images/logo-mark.png';
import { routes } from '../data/site';
import { treatmentCategories } from '../data/treatments';
import { findTreatmentPage, type SplitHeading, type TreatmentPage as Page } from '../data/treatmentPages';
import { useParallax } from '../hooks/useParallax';

type HeadingProps = {
  as: ElementType;
  text: SplitHeading;
  className?: string;
  delay?: number;
  keepAccentTogether?: boolean;
};

// "<lead> <em>accent</em>" headline that rises word by word when it scrolls into view
function Heading({ as, text, className, delay, keepAccentTogether = false }: HeadingProps) {
  return (
    <SplitText as={as} delay={delay} className={className}>
      {text.lead} <em className={keepAccentTogether ? 'whitespace-nowrap' : undefined}>{text.accent}</em>
    </SplitText>
  );
}

const ease = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

function Hero({ hero }: { hero: Page['hero'] }) {
  const photoRef = useParallax<HTMLDivElement>(0.3, 'top');

  return (
    <section className="relative isolate flex min-h-[640px] items-center overflow-hidden bg-[#8C7462] lg:h-[700px]">
      <div ref={photoRef} className="parallax absolute inset-0 -z-20">
        <img
          src={hero.image}
          alt={hero.imageAlt}
          fetchPriority="high"
          className={`decor-motion h-full w-full animate-kenburns object-cover ${hero.imagePosition ?? 'object-[center_60%]'}`}
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/45 via-[#5F4C3C]/35 to-ink/45" />
      <GlowOrb className="left-[calc(50%-350px)] top-[10%] h-[700px] w-[700px] mix-blend-soft-light" color="rgba(250, 238, 222, 0.85)" />
      <Sparkles
        className="-z-10 hidden text-cream/80 sm:block"
        items={[
          { top: '28%', left: '14%', size: 14, delay: 0.5 },
          { top: '62%', left: '9%', size: 9, delay: 2.2 },
          { top: '24%', left: '84%', size: 10, delay: 1.4 },
          { top: '66%', left: '88%', size: 16, delay: 3.3 },
        ]}
      />
      <div className="container-site flex flex-col items-center pb-16 pt-32 text-center">
        <Heading as="h1" text={hero.title} delay={350} keepAccentTogether className="heading-xl text-[52px] text-cream sm:text-6xl lg:text-[88px]" />
        <Reveal as="p" variant="blur" delay={900} className="mt-5 max-w-[470px] text-base leading-relaxed text-cream/90 sm:text-lg">
          {hero.subtitle}
        </Reveal>
        <Reveal delay={1100} className="mt-8">
          <Link
            to={routes.booking}
            className="sheen relative isolate block overflow-hidden rounded-full bg-cream px-8 py-3 font-serif text-xl italic text-ink shadow-soft transition duration-500 [--sheen:rgba(131,104,85,0.22)] hover:-translate-y-0.5 hover:bg-white"
          >
            Book your skin consultation
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function Why({ why }: { why: Page['why'] }) {
  return (
    <section className="relative isolate overflow-hidden bg-cocoa py-20 sm:py-[120px]">
      <GlowOrb className="-left-40 -top-40 h-[620px] w-[620px]" color="rgba(131, 104, 85, 0.5)" />
      <GlowOrb className="-right-48 bottom-[-20%] h-[520px] w-[520px]" color="rgba(114, 95, 76, 0.45)" delay={-9} />
      <Sparkles
        className="text-sand/50"
        items={[
          { top: '12%', left: '44%', size: 10, delay: 0.8 },
          { top: '82%', left: '6%', size: 14, delay: 2.6 },
        ]}
      />
      <div className="container-site grid gap-12 lg:grid-cols-[1fr_546px] lg:items-center lg:gap-[88px]">
        <div className="max-w-[520px]">
          <SectionLabel className="!text-taupe">Why clients love it</SectionLabel>
          <Heading as="h2" text={why.heading} delay={150} className="heading-lg mt-5 text-sand" />
          <Reveal as="p" variant="blur" delay={500} className="mt-5 text-base leading-relaxed text-taupe">
            {why.body}
          </Reveal>
        </div>
        <ul className="flex flex-col gap-10 sm:gap-12">
          {why.points.map(({ icon: Icon, title, body }, i) => (
            <Reveal as="li" variant="right" key={title} delay={i * 160} className="group flex flex-col gap-3.5">
              <span className="relative grid h-12 w-12 place-items-center rounded-full border border-sand/20 transition duration-700 group-hover:border-sand/60 group-hover:bg-sand/5">
                <Icon className="h-[26px] w-[26px] text-sand" aria-hidden />
              </span>
              <h3 className="font-serif text-[26px] leading-tight text-sand sm:text-[28px]">{title}</h3>
              <p className="max-w-[460px] text-[15px] leading-relaxed text-taupe">{body}</p>
              <span aria-hidden className={`h-px w-12 bg-sand/25 transition-[width] duration-700 ${ease} group-hover:w-28`} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Menu({ menu, benefits }: { menu: Page['menu']; benefits: string[] }) {
  return (
    <section className="bg-sand pt-20 sm:pt-[100px]">
      <div className="container-site">
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal className="rounded-[22px] bg-stone px-6 py-8 sm:p-10 lg:self-start">
            <Heading as="h2" text={menu.heading} delay={200} className="heading-md" />
            <div className="mt-8 flex flex-col gap-[26px] sm:mt-10">
              {menu.groups.map((group, g) => (
                <div key={group.label ?? g}>
                  {group.label && (
                    <Reveal as="h3" variant="left" className="pb-1 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">
                      {group.label}
                    </Reveal>
                  )}
                  <ul>
                    {group.items.map((item, i) => (
                      <Reveal
                        as="li"
                        variant="fade"
                        key={item.name}
                        delay={300 + Math.min(i, 8) * 70}
                        className={`group flex justify-between gap-4 border-b border-dotted border-ink/30 py-3.5 font-serif text-lg text-ink sm:text-xl ${
                          item.description ? 'items-start' : 'items-center'
                        }`}
                      >
                        <span className={`flex flex-col gap-1 transition-transform duration-500 ${ease} group-hover:translate-x-1.5`}>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {item.name}
                            {item.bestSeller && (
                              <span className="shimmer rounded-full bg-cocoa px-2 py-px font-sans text-[10px] font-bold text-cream">
                                Best seller
                              </span>
                            )}
                          </span>
                          {item.description && (
                            <span className="font-sans text-[13px] leading-relaxed text-muted">{item.description}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-muted transition-colors duration-500 group-hover:text-ink">{item.price}</span>
                      </Reveal>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-[460px] text-[13px] leading-relaxed text-muted">{menu.note}</p>
          </Reveal>
          <ParallaxImage
            src={menu.image}
            alt={menu.imageAlt}
            delay={200}
            className="h-[480px] w-full rounded-[22px] sm:h-[640px] lg:h-full lg:min-h-[560px]"
          />
        </div>

        <Reveal variant="fade" className="mt-4 flex overflow-hidden rounded-2xl border border-[#E6DFD5] bg-cream py-[17px]" aria-label="Benefits">
          <ul className="flex shrink-0 animate-marquee-left items-center hover:[animation-play-state:paused]">
            {/* Duplicated so the loop is seamless; the copy is hidden from screen readers */}
            {[...benefits, ...benefits, ...benefits, ...benefits].map((b, i) => (
              <li
                key={i}
                aria-hidden={i >= benefits.length}
                className="flex items-center gap-8 whitespace-nowrap pr-8 font-serif text-xl text-muted sm:text-[22px]"
              >
                {b}
                <span className="decor-motion inline-block animate-twinkle font-sans text-xs text-bronze" style={{ animationDelay: `${(i % 4) * 0.7}s` }} aria-hidden>
                  ✦
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Experience({ experience }: { experience: Page['experience'] }) {
  const cardClass =
    'group flex flex-col items-center justify-center gap-3.5 rounded-[22px] border border-[#E6DFD5] px-8 py-14 text-center lg:py-10';

  return (
    <section className="bg-sand py-20 sm:py-[100px]">
      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel lines="both">The experience</SectionLabel>
          <Heading as="h2" text={experience.heading} delay={150} className="heading-lg mt-5 max-w-[620px]" />
          <Reveal as="p" variant="blur" delay={450} className="mt-4 max-w-[530px] text-base text-muted sm:text-[17px]">
            {experience.body}
          </Reveal>
        </header>

        <div className="mt-10 grid gap-3.5 sm:mt-14 lg:grid-cols-[380px_1fr]">
          <ParallaxImage
            src={experience.image}
            alt={experience.imageAlt}
            className="h-[460px] w-full rounded-[22px] sm:h-[560px] lg:h-[694px]"
          />
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-rows-2">
            {experience.features.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} variant="scale" delay={150 + i * 140} className={cardClass}>
                <Icon
                  className="decor-motion h-11 w-11 animate-float text-bronze"
                  style={{ animationDelay: `${i * 0.9}s` }}
                  aria-hidden
                />
                <h3 className="font-serif text-[28px] leading-tight text-ink sm:text-[32px]">{title}</h3>
                <p className="max-w-[283px] text-sm leading-relaxed text-muted">{body}</p>
              </Reveal>
            ))}
            <Reveal variant="scale" delay={600} className="relative isolate flex min-h-[320px] flex-col items-center justify-center gap-[22px] text-center">
              <Flower className="absolute inset-0 -z-10 m-auto h-full max-h-[340px] w-full" />
              <p className="max-w-[190px] font-serif text-[28px] leading-tight text-ink">{experience.question}</p>
              <Link
                to={routes.booking}
                className="group inline-flex items-center gap-2.5 rounded-full bg-cocoa p-[5px] pr-5 text-cream transition duration-500 hover:-translate-y-0.5 hover:bg-ink"
              >
                <span className="relative grid h-[34px] w-[34px] place-items-center rounded-full bg-cream transition group-hover:scale-105">
                  <span aria-hidden className="decor-motion absolute inset-0 animate-pulse-ring rounded-full bg-cream" />
                  <img src={logoMark} alt="" aria-hidden className="relative h-[18px] w-auto brightness-0" />
                </span>
                <span className="font-serif text-lg italic">Book a consultation</span>
              </Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TreatmentPage() {
  const { slug } = useParams();
  const page = findTreatmentPage(slug);

  if (!page) {
    const category = treatmentCategories.find((t) => t.slug === slug);
    return <ComingSoon title={category ? category.title : 'Page not found'} />;
  }

  return (
    <>
      <Hero hero={page.hero} />
      <Why why={page.why} />
      <Menu menu={page.menu} benefits={page.benefits} />
      <Experience experience={page.experience} />
      <Testimonials />
    </>
  );
}
