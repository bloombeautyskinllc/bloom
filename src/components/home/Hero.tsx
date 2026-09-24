import { Link } from 'react-router-dom';
import SectionLabel from '../ui/SectionLabel';
import Reveal from '../motion/Reveal';
import SplitText from '../motion/SplitText';
import CountUp from '../motion/CountUp';
import GlowOrb from '../decor/GlowOrb';
import Sparkles from '../decor/Sparkles';
import RotatingBadge from '../decor/RotatingBadge';
import { useParallax } from '../../hooks/useParallax';
import heroImage from '../../assets/images/hero.webp';
import { routes, site } from '../../data/site';

const highlights = [
  { value: site.treatmentsPerformed, label: 'treatments performed' },
  { value: null, label: 'Certified cosmetologists' },
  { value: site.rating, label: 'client rating' },
];

const sparkles = [
  { top: '22%', left: '62%', size: 14, delay: 0.4 },
  { top: '34%', left: '86%', size: 10, delay: 1.8 },
  { top: '58%', left: '74%', size: 18, delay: 2.9 },
  { top: '16%', left: '92%', size: 8, delay: 3.6 },
  { top: '70%', left: '55%', size: 9, delay: 1.1 },
];

export default function Hero() {
  const photoRef = useParallax<HTMLDivElement>(0.3, 'top');

  return (
    <section className="relative isolate flex min-h-[720px] flex-col overflow-hidden bg-[#8C7462] sm:min-h-[800px] lg:h-[clamp(860px,59.72vw,100svh)]">
      <div ref={photoRef} className="parallax absolute inset-0 -z-20">
        <img
          src={heroImage}
          alt="Client relaxing during a facial in a warm, softly lit treatment suite"
          fetchPriority="high"
          className="decor-motion h-full w-full animate-kenburns object-cover object-[70%_center] lg:object-[center_30%]"
        />
      </div>
      {/* Warm tint for legibility, heavier on the left and bottom where the copy sits */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#A48A73]/40 via-[#8C7462]/50 to-[#5F4C3C]/80 lg:bg-gradient-to-r lg:from-[#5F4C3C]/75 lg:via-[#8C7462]/35 lg:to-transparent" />
      {/* Candle-like pool of light drifting over the suite */}
      <GlowOrb className="right-[-10%] top-[5%] h-[620px] w-[620px] opacity-60 mix-blend-soft-light" color="rgba(250, 238, 222, 0.9)" />
      <Sparkles items={sparkles} className="-z-10 hidden text-cream/80 sm:block" />

      <div className="container-site relative flex flex-1 flex-col justify-end pb-12 pt-32 sm:justify-center sm:pb-16 lg:pt-36">
        <div className="max-w-[760px] lg:max-w-[860px]">
          <SectionLabel tone="light" delay={300} className="max-sm:[&>span:last-child]:hidden">
            Advanced cosmetology &amp; clinical skin care
          </SectionLabel>
          <SplitText as="h1" delay={450} className="heading-xl mt-5 text-cream sm:mt-6">
            The <em>art of renewing</em> your skin from its deepest layers.
          </SplitText>
          <Reveal as="p" variant="blur" delay={1100} className="mt-5 max-w-[500px] text-base leading-relaxed text-cream/90 sm:mt-6 sm:text-lg">
            Personalized facial protocols that combine dermatological science, advanced technology and a sensory
            experience, designed to bring back your skin&apos;s natural glow.
          </Reveal>
          <Reveal delay={1300} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={routes.booking} className="btn-light py-2.5 font-serif text-lg font-normal italic sm:text-xl">
              Book your skin consultation
            </Link>
            <Link to="/#treatments" className="btn-ghost-light py-2.5 font-serif text-lg font-normal italic sm:text-xl">
              Explore our treatments
            </Link>
          </Reveal>
          <Reveal as="p" variant="fade" delay={1550} className="mt-6 text-sm text-cream/85">
            Private treatment suite · A personalized plan from your very first visit
          </Reveal>
        </div>

        {/* Turning brand seal, doubling as a booking shortcut */}
        <Reveal variant="scale" delay={1500} className="absolute bottom-16 right-10 hidden lg:block">
          <Link to={routes.booking} aria-label="Book your skin consultation" className="group block">
            <RotatingBadge className="transition duration-500 group-hover:scale-105 group-hover:bg-cream/20" />
          </Link>
        </Reveal>

        {/* Scroll cue */}
        <div aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:block">
          <div className="flex animate-enter-up flex-col items-center gap-2 [animation-delay:1.9s]">
            <span className="text-[10px] uppercase tracking-[0.3em] text-cream/70">Scroll</span>
            <span className="relative h-10 w-px overflow-hidden bg-cream/25">
              <span className="decor-motion absolute inset-x-0 top-0 h-1/3 animate-scroll-cue bg-cream" />
            </span>
          </div>
        </div>
      </div>

      <div className="animate-enter-up bg-ink/25 backdrop-blur-[2px] [animation-delay:1.6s]">
        <ul className="container-site flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4 text-cream sm:justify-around sm:py-[23px]">
          {highlights.map((h, i) => (
            <li
              key={h.label}
              style={{ animationDelay: `${1.8 + i * 0.15}s` }}
              className="flex animate-enter-up items-center gap-3 text-sm sm:text-[15px]"
            >
              <span className="decor-motion inline-block animate-twinkle text-[13px] text-stone" style={{ animationDelay: `${i * 1.2}s` }} aria-hidden>
                ✦
              </span>
              {h.value && <CountUp value={h.value} className="font-serif text-xl sm:text-[24px]" />}
              <span>{h.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
