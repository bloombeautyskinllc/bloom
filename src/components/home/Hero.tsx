import { Link } from 'react-router-dom';
import SectionLabel from '../ui/SectionLabel';
import heroImage from '../../assets/images/hero.webp';
import { routes, site } from '../../data/site';

const highlights = [
  { value: site.treatmentsPerformed, label: 'treatments performed' },
  { value: null, label: 'Certified cosmetologists' },
  { value: site.rating, label: 'client rating' },
];

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-[720px] flex-col overflow-hidden bg-[#8C7462] sm:min-h-[800px] lg:h-[860px]">
      <img
        src={heroImage}
        alt="Client relaxing during a facial in a warm, softly lit treatment suite"
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center] lg:object-center"
      />
      {/* Warm tint for legibility, heavier on the left and bottom where the copy sits */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#A48A73]/40 via-[#8C7462]/50 to-[#5F4C3C]/80 lg:bg-gradient-to-r lg:from-[#5F4C3C]/75 lg:via-[#8C7462]/35 lg:to-transparent" />

      <div className="container-site flex flex-1 flex-col justify-end pb-12 pt-32 sm:justify-center sm:pb-16 lg:pt-36">
        <div className="max-w-[760px]">
          <SectionLabel tone="light">Advanced cosmetology &amp; clinical skin care</SectionLabel>
          <h1 className="heading-xl mt-5 text-cream sm:mt-6">
            The <em>art of renewing</em> your skin from its deepest layers.
          </h1>
          <p className="mt-5 max-w-[500px] text-base leading-relaxed text-cream/90 sm:mt-6 sm:text-lg">
            Personalized facial protocols that combine dermatological science, advanced technology and a sensory
            experience, designed to bring back your skin&apos;s natural glow.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={routes.booking} className="btn-light">
              Book your skin consultation
            </Link>
            <Link to="/#treatments" className="btn-ghost-light">
              Explore our treatments
            </Link>
          </div>
          <p className="mt-6 text-sm text-cream/85">
            Private treatment suite · A personalized plan from your very first visit
          </p>
        </div>
      </div>

      <div className="bg-ink/25 backdrop-blur-[2px]">
        <ul className="container-site flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4 text-cream sm:justify-around sm:py-[23px]">
          {highlights.map((h) => (
            <li key={h.label} className="flex items-center gap-3 text-sm sm:text-[15px]">
              <span className="text-[13px] text-stone" aria-hidden>
                ✦
              </span>
              {h.value && <strong className="text-lg font-bold sm:text-[22px]">{h.value}</strong>}
              <span>{h.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
