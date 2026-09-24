import SectionLabel from '../ui/SectionLabel';
import Flower from '../ui/Flower';
import approachFace from '../../assets/images/approach-face.webp';
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

function FaceCard() {
  return (
    <div className="relative isolate h-[620px] overflow-hidden rounded-[22px] sm:h-[680px] lg:row-span-2 lg:h-auto">
      <img
        src={approachFace}
        alt="Woman with glowing skin holding her face with both hands"
        loading="lazy"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/35 via-transparent to-ink/10" />
      <div className="flex h-full flex-col items-center px-6 pt-10 text-center">
        <p className="max-w-[300px] text-[28px] font-medium leading-[1.1] tracking-[-0.02em] text-white sm:text-[32px]">
          Clinical-grade products, chosen with intention
        </p>
        <ul className="mt-6 flex flex-col items-center rounded-full border border-dashed border-white/70 px-3 py-3">
          {principles.map((p) => (
            <li
              key={p}
              className="-my-px grid h-[122px] w-[122px] place-items-center rounded-full border border-white/80 px-1 font-serif text-lg leading-tight text-white sm:h-[136px] sm:w-[136px] sm:text-xl"
            >
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BenefitsMarquee() {
  return (
    <div className="relative isolate flex min-h-[340px] flex-col justify-between overflow-hidden rounded-[22px] py-8 sm:py-10">
      <img src={approachMassage} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-ink/35" />
      <p className="px-7 text-[28px] font-medium tracking-[-0.02em] text-white sm:px-10 sm:text-[34px]">
        Your skin deserves better
      </p>
      <div className="mt-10 flex flex-col gap-3" aria-label="Benefits">
        {benefitRows.map((row, i) => (
          <div key={i} className="flex overflow-hidden">
            <ul
              className={`flex shrink-0 gap-3 pr-3 ${i % 2 === 0 ? 'animate-marquee-left' : 'animate-marquee-right'}`}
              style={{ animationDuration: `${36 + i * 6}s` }}
            >
              {/* Duplicated so the loop is seamless; the copy is hidden from screen readers */}
              {[...row, ...row].map((b, j) => (
                <li
                  key={j}
                  aria-hidden={j >= row.length}
                  className="whitespace-nowrap rounded-xl border border-white/40 bg-white/10 px-4 py-1.5 font-serif text-lg text-white backdrop-blur-sm sm:text-2xl"
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[22px] bg-gradient-to-b from-[#EFE6DC] to-latte px-8 py-14 text-center lg:w-[400px]">
      <p className="text-[13px] font-bold text-ink">
        <span className="tracking-[0.15em]" aria-hidden>
          ★★★★★
        </span>
        <span className="ml-3">4.9/5</span>
      </p>
      <p className="max-w-[180px] text-sm uppercase leading-snug tracking-[0.06em] text-ink">Trusted by hundreds of clients</p>
      <div className="mt-3 flex -space-x-4">
        {[avatar1, avatar2, avatar3].map((a, i) => (
          <img key={i} src={a} alt="" loading="lazy" className="h-[62px] w-[62px] rounded-full border-4 border-cream object-cover" />
        ))}
      </div>
    </div>
  );
}

export default function Approach() {
  return (
    <section id="method" className="bg-sand py-20 sm:py-[100px]">
      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel>Our approach</SectionLabel>
          <h2 className="heading-lg mt-5 max-w-[520px]">
            A beauty experience designed <em>around you.</em>
          </h2>
        </header>

        <div className="mt-10 flex flex-col gap-4 sm:mt-14">
          <div className="grid gap-4 lg:grid-cols-[396px_1fr] lg:grid-rows-[auto_340px]">
            <FaceCard />

            <div className="rounded-[22px] bg-cocoa px-7 py-10 sm:px-12 sm:pb-12 sm:pt-[72px]">
              <p className="bg-gradient-to-b from-sand from-40% to-sand/15 bg-clip-text font-serif text-[24px] leading-[1.25] text-transparent sm:text-[34px]">
                Every protocol at BLOOM begins with a diagnosis, not a menu. We study your skin, choose each active with
                intention and design every session around what your skin needs today, so your results look natural, feel
                safe and are entirely yours.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative isolate flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
                <Flower className="absolute inset-0 -z-10 m-auto h-full max-h-[320px] w-full" />
                <p className="text-6xl font-light tracking-[-0.03em] text-ink sm:text-7xl">+500</p>
                <p className="max-w-[190px] text-xs uppercase leading-relaxed tracking-[0.08em] text-muted">
                  Treatments performed with care and expertise
                </p>
              </div>
              <img
                src={approachProfile}
                alt="Profile portrait with the BLOOM monogram"
                loading="lazy"
                className="h-[300px] w-full rounded-[22px] object-cover sm:h-[340px] lg:h-full"
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
