import { Link } from 'react-router-dom';
import SectionLabel from '../ui/SectionLabel';
import Reveal from '../motion/Reveal';
import SplitText from '../motion/SplitText';
import CountUp from '../motion/CountUp';
import ParallaxImage from '../motion/ParallaxImage';
import GlowOrb from '../decor/GlowOrb';
import Sparkles from '../decor/Sparkles';
import RotatingBadge from '../decor/RotatingBadge';
import aboutSuite from '../../assets/images/image_treatment_suite_replace_.webp';

const pillars = [
  'Certified cosmetologists',
  '100% personalized treatments',
  'Visible, safe results',
  'Private suite & advanced technology',
];

const stats = [
  {
    value: '1,200+',
    title: 'Skin transformations',
    body: 'Every treatment guided by a personalized diagnosis, never a one-size-fits-all menu.',
  },
  {
    value: '25+',
    title: 'Clinical protocols',
    body: 'From microneedling and professional peels to micropigmentation and diode laser.',
  },
  {
    value: '4.9/5 ★',
    title: 'Client satisfaction',
    body: 'Trusted for tangible results and deep respect for your skin barrier.',
  },
];

export default function About() {
  return (
    <section
      id="about"
      className="relative isolate overflow-hidden bg-gradient-to-b from-cream via-sand to-stone pb-20 pt-6 sm:pb-[120px] sm:pt-[60px]"
    >
      <GlowOrb className="-right-40 top-1/3 h-[600px] w-[600px]" color="rgba(205, 194, 180, 0.55)" delay={-5} />

      <div className="container-site">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionLabel>About us</SectionLabel>
            <SplitText as="h2" delay={150} className="heading-lg mt-5">
              Advanced cosmetology driven by diagnosis, science and <em>real results.</em>
            </SplitText>
            <Reveal as="p" variant="blur" delay={500} className="mt-5 max-w-[512px] text-base leading-relaxed text-muted">
              At BLOOM, every treatment starts with understanding your skin. We combine cutting-edge technology,
              clinical-grade cosmeceuticals and one-on-one care in a private suite, so your skin gets exactly what it
              needs and nothing it doesn&apos;t.
            </Reveal>
            <Reveal delay={650} className="mt-7">
              <Link to="/#method" className="btn-dark">
                Discover our method
              </Link>
            </Reveal>
            <ul className="mt-8 grid gap-x-6 gap-y-3.5 text-[15px] text-bronze sm:grid-cols-2">
              {pillars.map((p, i) => (
                <Reveal as="li" variant="left" key={p} delay={750 + i * 110} className="flex gap-2.5">
                  <span aria-hidden className="decor-motion inline-block animate-twinkle" style={{ animationDelay: `${i * 0.9}s` }}>
                    ✦
                  </span>
                  {p}
                </Reveal>
              ))}
            </ul>
          </div>

          <div className="relative">
            <ParallaxImage
              src={aboutSuite}
              alt="BLOOM's cosmetologist seated in the private treatment suite"
              delay={200}
              className="aspect-[4/3] w-full rounded-[22px] lg:aspect-auto lg:h-[470px]"
            />
            <Reveal variant="scale" delay={900} className="absolute -bottom-10 -left-6 hidden sm:block lg:-left-12">
              <RotatingBadge tone="dark" text="Diagnosis ✦ Science ✦ Real results ✦ " />
            </Reveal>
            <Sparkles
              className="-right-4 -top-6 left-auto h-24 w-24 text-accent"
              items={[
                { top: '10%', left: '60%', size: 16, delay: 0.3 },
                { top: '55%', left: '85%', size: 9, delay: 1.9 },
              ]}
            />
          </div>
        </div>

        <Reveal
          as="dl"
          delay={100}
          className="mt-14 grid divide-y divide-stone rounded-[22px] bg-white shadow-soft sm:mt-20 md:grid-cols-3 md:divide-x md:divide-y-0"
        >
          {stats.map((s, i) => (
            <Reveal key={s.title} variant="fade" delay={350 + i * 180} className="group flex flex-col gap-2 px-7 py-7 sm:px-8 sm:py-[34px]">
              <dd className="order-first text-[36px] font-bold leading-none tracking-[-0.02em] text-accent sm:text-[42px]">
                <CountUp value={s.value} />
              </dd>
              <dt className="mt-2 text-base font-bold text-ink">{s.title}</dt>
              <dd className="text-sm leading-relaxed text-muted">{s.body}</dd>
              <span
                aria-hidden
                className="mt-2 h-px w-8 bg-accent/40 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-20"
              />
            </Reveal>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
