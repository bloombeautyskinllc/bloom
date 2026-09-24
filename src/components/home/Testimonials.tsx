import { useRef } from 'react';
import SectionLabel from '../ui/SectionLabel';
import Stars from '../ui/Stars';
import Reveal from '../motion/Reveal';
import SplitText from '../motion/SplitText';
import GlowOrb from '../decor/GlowOrb';
import { testimonials } from '../../data/testimonials';

const ease = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

export default function Testimonials() {
  const trackRef = useRef<HTMLUListElement>(null);

  const scroll = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 32 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section id="stories" className="relative isolate overflow-hidden bg-gradient-to-b from-sand to-stone py-20 sm:py-[100px]">
      <GlowOrb className="-left-40 top-24 h-[560px] w-[560px]" color="rgba(250, 248, 245, 0.85)" />
      <GlowOrb className="-right-40 bottom-0 h-[480px] w-[480px]" color="rgba(205, 194, 180, 0.5)" delay={-11} />

      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel lines="both">Client stories</SectionLabel>
          <SplitText as="h2" delay={150} className="heading-lg mt-5 max-w-[720px]">
            Experiences shared by <em>our clients.</em>
          </SplitText>
        </header>
      </div>

      <ul
        ref={trackRef}
        className="mt-10 flex snap-x snap-mandatory scroll-pl-5 gap-8 overflow-x-auto scroll-smooth px-5 pb-2.5 [scrollbar-width:none] sm:mt-14 sm:scroll-pl-8 sm:px-8 lg:scroll-pl-[max(2.5rem,calc((100vw_-_1240px)/2_+_2.5rem))] lg:pl-[max(2.5rem,calc((100vw_-_1240px)/2_+_2.5rem))] [&::-webkit-scrollbar]:hidden"
        aria-label="Client testimonials"
      >
        {testimonials.map((t, i) => (
          <Reveal
            as="li"
            key={t.quote}
            delay={Math.min(i, 3) * 150}
            className="group flex w-[85vw] max-w-[640px] shrink-0 snap-start flex-col gap-6 sm:w-[600px] sm:flex-row sm:items-center sm:gap-7"
          >
            <div className="relative shrink-0 overflow-hidden rounded-[14px]">
              <img
                src={t.image}
                alt=""
                loading="lazy"
                className={`reveal-zoom aspect-[5/7] w-full object-cover sm:h-[350px] sm:w-[250px]`}
              />
              <span className="absolute left-3 top-3 rounded-lg bg-cream/95 px-3 py-1 font-serif text-lg text-ink shadow-soft">
                {t.tag}
              </span>
            </div>
            <figure className="flex flex-col gap-3.5">
              <Stars rating={t.rating} className="text-xs text-accent" />
              <blockquote className="relative font-serif text-[28px] leading-[1.1] text-ink sm:text-[33px]">
                {/* Oversized opening quote mark as a watermark */}
                <span aria-hidden className="pointer-events-none absolute -left-3 -top-7 -z-10 select-none font-serif text-[110px] leading-none text-accent/15">
                  “
                </span>
                “{t.quote}”
              </blockquote>
              <p className="text-sm leading-relaxed text-muted">{t.body}</p>
              <figcaption className="flex items-center gap-3 text-[13px] font-bold text-ink">
                <span aria-hidden className={`h-px w-6 bg-accent/60 transition-[width] duration-700 ${ease} group-hover:w-12`} />
                {t.treatment}
              </figcaption>
            </figure>
          </Reveal>
        ))}
        {/* End spacer so the last card can snap to the start */}
        <li aria-hidden className="w-px shrink-0 sm:w-[20vw]" />
      </ul>

      <Reveal variant="fade" delay={300} className="mt-10 flex justify-center">
        <div className="flex items-center gap-1 rounded-full bg-cocoa p-[5px] shadow-soft">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Previous testimonial"
            className="rounded-full px-4 py-1.5 text-lg text-cream transition duration-300 hover:bg-cream hover:text-ink active:scale-90"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Next testimonial"
            className="rounded-full px-4 py-1.5 text-lg text-cream transition duration-300 hover:bg-cream hover:text-ink active:scale-90"
          >
            ›
          </button>
        </div>
      </Reveal>
    </section>
  );
}
