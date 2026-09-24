import { Link } from 'react-router-dom';
import SectionLabel from '../ui/SectionLabel';
import aboutSuite from '../../assets/images/about-suite.webp';

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
    <section id="about" className="bg-gradient-to-b from-cream via-sand to-stone pb-20 pt-6 sm:pb-[120px] sm:pt-[60px]">
      <div className="container-site">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionLabel>About us</SectionLabel>
            <h2 className="heading-lg mt-5">
              Advanced cosmetology driven by diagnosis, science and <em>real results.</em>
            </h2>
            <p className="mt-5 max-w-[512px] text-base leading-relaxed text-muted">
              At BLOOM, every treatment starts with understanding your skin. We combine cutting-edge technology,
              clinical-grade cosmeceuticals and one-on-one care in a private suite, so your skin gets exactly what it
              needs and nothing it doesn&apos;t.
            </p>
            <Link to="/#method" className="btn-dark mt-7">
              Discover our method
            </Link>
            <ul className="mt-8 grid gap-x-6 gap-y-3.5 text-[15px] text-bronze sm:grid-cols-2">
              {pillars.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span aria-hidden>✦</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <img
            src={aboutSuite}
            alt="BLOOM's private treatment suite with a reclining facial chair and skincare shelves"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-[22px] object-cover lg:aspect-auto lg:h-[470px]"
          />
        </div>

        <dl className="mt-14 grid divide-y divide-stone rounded-[22px] bg-white shadow-soft sm:mt-20 md:grid-cols-3 md:divide-x md:divide-y-0">
          {stats.map((s) => (
            <div key={s.title} className="flex flex-col gap-2 px-7 py-7 sm:px-8 sm:py-[34px]">
              <dd className="order-first text-[36px] font-bold leading-none tracking-[-0.02em] text-accent sm:text-[42px]">
                {s.value}
              </dd>
              <dt className="mt-2 text-base font-bold text-ink">{s.title}</dt>
              <dd className="text-sm leading-relaxed text-muted">{s.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
