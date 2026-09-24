import { Link } from 'react-router-dom';
import { FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa';
import Logo from '../ui/Logo';
import logoMark from '../../assets/images/logo-mark.png';
import ctaSuite from '../../assets/images/cta-suite.webp';
import { routes, site } from '../../data/site';
import { treatmentCategories } from '../../data/treatments';

const quickLinks = [
  { label: 'About us', href: '/#about' },
  { label: 'The method', href: '/#method' },
  { label: 'Client stories', href: '/#stories' },
  { label: 'FAQ', href: '/#faq' },
];

const legalLinks = [
  { label: 'Privacy policy', href: routes.privacy },
  { label: 'Terms of service', href: routes.terms },
  { label: 'Client intake form', href: routes.intakeForm },
];

function FooterColumn({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="text-sm text-bronze">{title}</h3>
      <ul className="mt-4 space-y-3 text-[15px] text-ink sm:mt-6">{children}</ul>
    </div>
  );
}

const linkClass = 'transition hover:text-accent';

export default function Footer({ showCta = true }: { showCta?: boolean }) {
  return (
    <footer className="relative isolate overflow-hidden bg-ink">
      <img
        src={ctaSuite}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-x-0 top-0 -z-10 h-[760px] w-full object-cover sm:h-[820px]"
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-[760px] bg-gradient-to-b from-ink/30 via-ink/40 to-ink sm:h-[820px]" />

      {showCta && (
        <div className="container-site flex flex-col items-center pb-20 pt-24 text-center sm:pb-28 sm:pt-40">
          <h2 className="heading-lg max-w-[620px] text-cream">
            Ready to meet the best version of <em>your skin?</em>
          </h2>
          <p className="mt-5 max-w-[400px] text-base text-cream/80 sm:text-lg">
            Book your skin consultation and leave with a clear, personalized plan for your skin.
          </p>
          <Link
            to={routes.booking}
            className="group mt-9 inline-flex items-center gap-3 rounded-full bg-cream py-1.5 pl-1.5 pr-6 text-ink shadow-soft transition hover:bg-white"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink transition group-hover:scale-105">
              <img src={logoMark} alt="" aria-hidden className="h-5 w-auto" />
            </span>
            <span className="font-serif text-xl italic">Book your skin consultation</span>
          </Link>
        </div>
      )}

      <div className={`mx-auto max-w-[1200px] px-3 sm:px-8 ${showCta ? '' : 'pt-40'}`}>
        <div className="overflow-hidden rounded-t-[22px] bg-stone px-6 pt-10 sm:px-10 sm:pt-12">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1.1fr_1.1fr_1.4fr]">
            <div className="col-span-2 lg:col-span-1">
              <Link to={routes.home} aria-label="BLOOM Beauty Skin — home">
                <Logo tone="dark" />
              </Link>
              <ul className="mt-8 space-y-2 text-[15px] text-bronze">
                <li>✓ Certified cosmetologists</li>
                <li>✦ Personalized protocols</li>
              </ul>
            </div>

            <FooterColumn title="Quick links">
              {quickLinks.map((l) => (
                <li key={l.label}>
                  <Link to={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </FooterColumn>

            <FooterColumn title="Treatments">
              {treatmentCategories.map((t) => (
                <li key={t.slug}>
                  <Link to={routes.treatment(t.slug)} className={linkClass}>
                    {t.shortTitle}
                  </Link>
                </li>
              ))}
            </FooterColumn>

            <FooterColumn title="Legal">
              {legalLinks.map((l) => (
                <li key={l.label}>
                  <Link to={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </FooterColumn>

            <FooterColumn title="Get in touch" className="col-span-2 lg:col-span-1">
              <li>
                <a href={site.address.mapsUrl} target="_blank" rel="noreferrer" className={`${linkClass} leading-relaxed`}>
                  {site.address.line1}
                  <br />
                  {site.address.line2}
                </a>
              </li>
              <li>
                <a href={site.phoneHref} className={linkClass}>
                  {site.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className={linkClass}>
                  {site.email}
                </a>
              </li>
            </FooterColumn>
          </div>

          <div className="mt-12 grid items-end gap-5 lg:mt-16 lg:grid-cols-[160px_minmax(0,1fr)_160px] lg:gap-6">
            <p className="text-center text-sm text-muted lg:pb-10 lg:text-left">
              © {new Date().getFullYear()} BLOOM Beauty Skin. All rights reserved.
            </p>
            {/* Oversized wordmark, intentionally cropped by the card's bottom edge */}
            <p
              aria-hidden
              className="order-last -mb-[0.27em] select-none text-center font-serif text-[24vw] font-medium leading-none tracking-[0.02em] text-ink lg:order-none lg:text-[min(200px,13.5vw)]"
            >
              BLOOM
            </p>
            <div className="flex items-center justify-center gap-5 text-bronze lg:justify-end lg:pb-10">
              <a href={site.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className={linkClass}>
                <FaInstagram className="h-6 w-6" />
              </a>
              <a href={site.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className={linkClass}>
                <FaFacebook className="h-6 w-6" />
              </a>
              <a href={site.social.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className={linkClass}>
                <FaTiktok className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
