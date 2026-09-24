import SectionLabel from '../ui/SectionLabel';
import Flower from '../ui/Flower';
import Reveal from '../motion/Reveal';
import SplitText from '../motion/SplitText';
import CountUp from '../motion/CountUp';
import ScrollText from '../motion/ScrollText';
import ParallaxImage from '../motion/ParallaxImage';
import Sparkles from '../decor/Sparkles';
import GlowOrb from '../decor/GlowOrb';
import approachFace from '../../assets/images/card_values_photo.webp';
import approachProfile from '../../assets/images/approach-profile.webp';
import approachMassage from '../../assets/images/approach-massage.webp';
import avatar1 from '../../assets/images/avatar-1.webp';
import avatar2 from '../../assets/images/avatar-2.webp';
import avatar3 from '../../assets/images/avatar-3.webp';

const principles = ['Clinical-grade actives', 'Personalized protocols', 'Barrier-first care'];

const benefitRows = [
  ['Deep hydration', 'Collagen renewal', 'Even tone', 'Brow definition', 'Barrier repair', 'Natural glow'],
  ['Smooth texture', 'Lasting results', 'Refined pores', 'Clinical care', 'Hair-free skin', 'Soft lip color'],
  ['Self-care ritual', 'Healthy barrier', 'Visible results', 'Radiant skin', 'Calm skin', 'Precision'],
];

const philosophy =
  'Every protocol at BLOOM begins with a diagnosis, not a menu. We study your skin, choose each active with intention and design every session around what your skin needs today, so your results look natural, feel safe and are entirely yours.';

function FaceCard() {
  return (
    <Reveal
      variant="wipe"
      className="relative isolate h-[620px] overflow-hidden rounded-[22px] sm:h-[680px] lg:row-span-2 lg:h-auto"
    >
      <img
        src={approachFace}
        alt="Portrait of a woman with radiant, glowing skin"
        loading="lazy"
        className="reveal-zoom absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/35 via-transparent to-ink/10" />
      <div className="flex h-full flex-col items-center px-6 pt-10 text-center">
        <SplitText as="p" delay={500} className="max-w-[300px] text-[28px] font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-[32px]">
          Clinical-grade products, chosen with intention
        </SplitText>
        <ul className="mt-6 flex flex-col items-center rounded-full border border-dashed border-white/70 px-3 py-3">
          {principles.map((p, i) => (
            <Reveal
              as="li"
              variant="scale"
              key={p}
              delay={800 + i * 180}
              className="-my-px grid h-[122px] w-[122px] place-items-center rounded-full border border-white/80 px-1 font-serif text-lg leading-tight text-white sm:h-[136px] sm:w-[136px] sm:text-xl"
            >
              <span className="decor-motion animate-float" style={{ animationDelay: `${i * 0.8}s` }}>
                {p}
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

function BenefitsMarquee() {
  return (
    <Reveal variant="wipe" className="relative isolate flex min-h-[340px] flex-col justify-between overflow-hidden rounded-[22px] py-8 sm:py-10">
      <img src={approachMassage} alt="" loading="lazy" className="reveal-zoom absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-ink/35" />
      <SplitText as="p" delay={400} className="px-7 text-[28px] font-medium tracking-[-0.02em] text-white sm:px-10 sm:text-[34px]">
        Your skin deserves better
      </SplitText>
      <div className="mt-10 flex flex-col gap-3" aria-label="Benefits">
        {benefitRows.map((row, i) => (
          <div key={i} className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <ul
              className={`flex shrink-0 gap-3 pr-3 hover:[animation-play-state:paused] ${i % 2 === 0 ? 'animate-marquee-left' : 'animate-marquee-right'}`}
              style={{ animationDuration: `${36 + i * 6}s` }}
            >
              {/* Duplicated so the loop is seamless; the copy is hidden from screen readers */}
              {[...row, ...row].map((b, j) => (
                <li
                  key={j}
                  aria-hidden={j >= row.length}
                  className="whitespace-nowrap rounded-xl border border-white/40 bg-white/10 px-4 py-1.5 font-serif text-lg text-white backdrop-blur-sm transition duration-500 hover:bg-white/25 sm:text-2xl"
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function TrustCard() {
  return (
    <Reveal
      variant="up"
      delay={150}
      className="relative isolate flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[22px] bg-gradient-to-b from-[#EFE6DC] to-latte px-8 py-14 text-center lg:w-[400px]"
    >
      <GlowOrb className="left-[calc(50%-160px)] top-0 h-[320px] w-[320px]" color="rgba(250, 248, 245, 0.9)" />
      <p className="text-[13px] font-bold text-ink">
        <SplitText by="char" delay={500} stagger={120} className="tracking-[0.15em]" aria-hidden>
          ★★★★★
        </SplitText>
        <span className="ml-3">
          <CountUp value="4.9/5" duration={1600} />
        </span>
      </p>
      <p className="max-w-[180px] text-sm uppercase leading-snug tracking-[0.06em] text-ink">Trusted by hundreds of clients</p>
      <div className="mt-3 flex -space-x-4">
        {[avatar1, avatar2, avatar3].map((a, i) => (
          <Reveal as="img" variant="scale" key={i} delay={700 + i * 140} src={a} alt="" loading="lazy" className="h-[62px] w-[62px] rounded-full border-4 border-cream object-cover" />
        ))}
      </div>
    </Reveal>
  );
}

export default function Approach() {
  return (
    <section id="method" className="bg-sand py-20 sm:py-[100px]">
      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel lines="both">Our approach</SectionLabel>
          <SplitText as="h2" delay={150} className="heading-lg mt-5 max-w-[520px]">
            A beauty experience designed <em>around you.</em>
          </SplitText>
        </header>

        <div className="mt-10 flex flex-col gap-4 sm:mt-14">
          <div className="grid gap-4 lg:grid-cols-[396px_1fr] lg:grid-rows-[auto_340px]">
            <FaceCard />

            <Reveal
              variant="up"
              delay={150}
              className="relative isolate overflow-hidden rounded-[22px] bg-cocoa px-7 py-10 sm:px-12 sm:pb-12 sm:pt-[72px]"
            >
              <GlowOrb className="-right-32 -top-32 h-[420px] w-[420px]" color="rgba(131, 104, 85, 0.45)" />
              <Sparkles
                className="text-sand/60"
                items={[
                  { top: '10%', left: '92%', size: 12, delay: 0.6 },
                  { top: '78%', left: '95%', size: 8, delay: 2.4 },
                ]}
              />
              <ScrollText text={philosophy} className="font-serif text-[24px] leading-[1.25] text-sand sm:text-[34px]" />
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2">
              <Reveal variant="scale" delay={200} className="relative isolate flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
                <Flower className="absolute inset-0 -z-10 m-auto h-full max-h-[320px] w-full" />
                <p className="text-6xl font-light tracking-[-0.03em] text-ink sm:text-7xl">
                  <CountUp value="+500" />
                </p>
                <p className="max-w-[190px] text-xs uppercase leading-relaxed tracking-[0.08em] text-muted">
                  Treatments performed with care and expertise
                </p>
              </Reveal>
              <ParallaxImage
                src={approachProfile}
                alt="Profile portrait with the BLOOM monogram"
                delay={300}
                className="h-[300px] w-full rounded-[22px] sm:h-[340px] lg:h-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="min-w-0 flex-1">
              <BenefitsMarquee />
            </div>
            <TrustCard />
          </div>
        </div>
      </div>
    </section>
  );
}
