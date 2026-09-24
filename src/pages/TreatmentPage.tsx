import { Link, useParams } from 'react-router-dom';
import SectionLabel from '../components/ui/SectionLabel';
import Flower from '../components/ui/Flower';
import Testimonials from '../components/home/Testimonials';
import ComingSoon from './ComingSoon';
import logoMark from '../assets/images/logo-mark.png';
import { routes } from '../data/site';
import { treatmentCategories } from '../data/treatments';
import { findTreatmentPage, type SplitHeading, type TreatmentPage as Page } from '../data/treatmentPages';

function Heading({ text, keepAccentTogether = false }: { text: SplitHeading; keepAccentTogether?: boolean }) {
  return (
    <>
      {text.lead} <em className={keepAccentTogether ? 'whitespace-nowrap' : undefined}>{text.accent}</em>
    </>
  );
}

function Hero({ hero }: { hero: Page['hero'] }) {
  return (
    <section className="relative isolate flex min-h-[640px] items-center overflow-hidden bg-[#8C7462] lg:h-[700px]">
      <img
        src={hero.image}
        alt={hero.imageAlt}
        fetchPriority="high"
        className={`absolute inset-0 -z-20 h-full w-full object-cover ${hero.imagePosition ?? 'object-[center_60%]'}`}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/45 via-[#5F4C3C]/35 to-ink/45" />
      <div className="container-site flex flex-col items-center pb-16 pt-32 text-center">
        <h1 className="heading-xl text-[52px] text-cream sm:text-6xl lg:text-[88px]">
          <Heading text={hero.title} keepAccentTogether />
        </h1>
        <p className="mt-5 max-w-[470px] text-base leading-relaxed text-cream/90 sm:text-lg">{hero.subtitle}</p>
        <Link
          to={routes.booking}
          className="mt-8 rounded-full bg-cream px-8 py-3 font-serif text-xl italic text-ink shadow-soft transition hover:bg-white"
        >
          Book your skin consultation
        </Link>
      </div>
    </section>
  );
}

function Why({ why }: { why: Page['why'] }) {
  return (
    <section className="bg-cocoa py-20 sm:py-[120px]">
      <div className="container-site grid gap-12 lg:grid-cols-[1fr_546px] lg:items-center lg:gap-[88px]">
        <div className="max-w-[520px]">
          <SectionLabel className="!text-taupe">Why clients love it</SectionLabel>
          <h2 className="heading-lg mt-5 text-sand">
            <Heading text={why.heading} />
          </h2>
          <p className="mt-5 text-base leading-relaxed text-taupe">{why.body}</p>
        </div>
        <ul className="flex flex-col gap-10 sm:gap-12">
          {why.points.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-3.5">
              <Icon className="h-[30px] w-[30px] text-sand" aria-hidden />
              <h3 className="font-serif text-[26px] leading-tight text-sand sm:text-[28px]">{title}</h3>
              <p className="max-w-[460px] text-[15px] leading-relaxed text-taupe">{body}</p>
            </li>
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
          <div className="rounded-[22px] bg-stone px-6 py-8 sm:p-10 lg:self-start">
            <h2 className="heading-md">
              <Heading text={menu.heading} />
            </h2>
            <div className="mt-8 flex flex-col gap-[26px] sm:mt-10">
              {menu.groups.map((group, g) => (
                <div key={group.label ?? g}>
                  {group.label && (
                    <h3 className="pb-1 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{group.label}</h3>
                  )}
                  <ul>
                    {group.items.map((item) => (
                      <li
                        key={item.name}
                        className={`flex justify-between gap-4 border-b border-dotted border-ink/30 py-3.5 font-serif text-lg text-ink sm:text-xl ${
                          item.description ? 'items-start' : 'items-center'
                        }`}
                      >
                        <span className="flex flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {item.name}
                            {item.bestSeller && (
                              <span className="rounded-full bg-cocoa px-2 py-px font-sans text-[10px] font-bold text-cream">
                                Best seller
                              </span>
                            )}
                          </span>
                          {item.description && (
                            <span className="font-sans text-[13px] leading-relaxed text-muted">{item.description}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-muted">{item.price}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-[460px] text-[13px] leading-relaxed text-muted">{menu.note}</p>
          </div>
          <img
            src={menu.image}
            alt={menu.imageAlt}
            loading="lazy"
            className="h-[480px] w-full rounded-[22px] object-cover sm:h-[640px] lg:h-full lg:min-h-[560px]"
          />
        </div>

        <div className="mt-4 flex overflow-hidden rounded-2xl border border-[#E6DFD5] bg-cream py-[17px]" aria-label="Benefits">
          <ul className="flex shrink-0 animate-marquee-left items-center">
            {/* Duplicated so the loop is seamless; the copy is hidden from screen readers */}
            {[...benefits, ...benefits, ...benefits, ...benefits].map((b, i) => (
              <li
                key={i}
                aria-hidden={i >= benefits.length}
                className="flex items-center gap-8 whitespace-nowrap pr-8 font-serif text-xl text-muted sm:text-[22px]"
              >
                {b}
                <span className="font-sans text-xs text-bronze" aria-hidden>
                  ✦
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Experience({ experience }: { experience: Page['experience'] }) {
  const cardClass =
    'flex flex-col items-center justify-center gap-3.5 rounded-[22px] border border-[#E6DFD5] px-8 py-14 text-center lg:py-10';

  return (
    <section className="bg-sand py-20 sm:py-[100px]">
      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel>The experience</SectionLabel>
          <h2 className="heading-lg mt-5 max-w-[620px]">
            <Heading text={experience.heading} />
          </h2>
          <p className="mt-4 max-w-[530px] text-base text-muted sm:text-[17px]">{experience.body}</p>
        </header>

        <div className="mt-10 grid gap-3.5 sm:mt-14 lg:grid-cols-[380px_1fr]">
          <img
            src={experience.image}
            alt={experience.imageAlt}
            loading="lazy"
            className="h-[460px] w-full rounded-[22px] object-cover sm:h-[560px] lg:h-[694px]"
          />
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-rows-2">
            {experience.features.map(({ icon: Icon, title, body }) => (
              <div key={title} className={cardClass}>
                <Icon className="h-11 w-11 text-bronze" aria-hidden />
                <h3 className="font-serif text-[28px] leading-tight text-ink sm:text-[32px]">{title}</h3>
                <p className="max-w-[283px] text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
            <div className="relative isolate flex min-h-[320px] flex-col items-center justify-center gap-[22px] text-center">
              <Flower className="absolute inset-0 -z-10 m-auto h-full max-h-[340px] w-full" />
              <p className="max-w-[190px] font-serif text-[28px] leading-tight text-ink">{experience.question}</p>
              <Link
                to={routes.booking}
                className="group inline-flex items-center gap-2.5 rounded-full bg-cocoa p-[5px] pr-5 text-cream transition hover:bg-ink"
              >
                <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-cream transition group-hover:scale-105">
                  <img src={logoMark} alt="" aria-hidden className="h-[18px] w-auto brightness-0" />
                </span>
                <span className="font-serif text-lg italic">Book a consultation</span>
              </Link>
            </div>
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
