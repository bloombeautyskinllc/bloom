import { useRef } from 'react';
import SectionLabel from '../ui/SectionLabel';
import Stars from '../ui/Stars';
import { testimonials } from '../../data/testimonials';

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
    <section id="stories" className="overflow-hidden bg-gradient-to-b from-sand to-stone py-20 sm:py-[100px]">
      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel>Client stories</SectionLabel>
          <h2 className="heading-lg mt-5 max-w-[720px]">
            Experiences shared by <em>our clients.</em>
          </h2>
        </header>
      </div>

      <ul
        ref={trackRef}
        className="mt-10 flex snap-x snap-mandatory scroll-pl-5 gap-8 overflow-x-auto scroll-smooth px-5 pb-2.5 [scrollbar-width:none] sm:mt-14 sm:scroll-pl-8 sm:px-8 lg:scroll-pl-[max(2.5rem,calc((100vw_-_1240px)/2_+_2.5rem))] lg:pl-[max(2.5rem,calc((100vw_-_1240px)/2_+_2.5rem))] [&::-webkit-scrollbar]:hidden"
        aria-label="Client testimonials"
      >
        {testimonials.map((t) => (
          <li
            key={t.quote}
            className="flex w-[85vw] max-w-[640px] shrink-0 snap-start flex-col gap-6 sm:w-[600px] sm:flex-row sm:items-center sm:gap-7"
          >
            <div className="relative shrink-0">
              <img
                src={t.image}
                alt=""
                loading="lazy"
                className="aspect-[5/7] w-full rounded-[14px] object-cover sm:h-[350px] sm:w-[250px]"
              />
              <span className="absolute left-3 top-3 rounded-lg bg-cream/95 px-3 py-1 font-serif text-lg text-ink">
                {t.tag}
              </span>
            </div>
            <figure className="flex flex-col gap-3.5">
              <Stars rating={t.rating} className="text-xs text-ink" />
              <blockquote className="font-serif text-[28px] leading-[1.1] text-ink sm:text-[33px]">
                “{t.quote}”
              </blockquote>
              <p className="text-sm leading-relaxed text-muted">{t.body}</p>
              <figcaption className="text-[13px] font-bold text-ink">{t.treatment}</figcaption>
            </figure>
          </li>
        ))}
        {/* End spacer so the last card can snap to the start */}
        <li aria-hidden className="w-px shrink-0 sm:w-[20vw]" />
      </ul>

      <div className="mt-10 flex justify-center">
        <div className="flex items-center gap-1 rounded-full bg-cocoa p-[5px]">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Previous testimonial"
            className="rounded-full px-4 py-1.5 text-lg text-cream transition hover:bg-cream/10"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Next testimonial"
            className="rounded-full px-4 py-1.5 text-lg text-cream transition hover:bg-cream/10"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
