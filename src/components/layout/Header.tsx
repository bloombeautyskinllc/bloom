import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiChevronDown, HiOutlineMenuAlt4, HiX } from 'react-icons/hi';
import { FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa';
import Logo from '../ui/Logo';
import { navLinks, routes, site } from '../../data/site';
import { treatmentCategories } from '../../data/treatments';
import { findTreatmentPage } from '../../data/treatmentPages';
import { setScrollLocked } from '../../lib/smoothScroll';

function SocialLinks() {
  const linkClass = 'transition hover:text-ink';
  return (
    <div className="flex items-center gap-[15px] text-accent">
      <a href={site.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className={linkClass}>
        <FaInstagram className="h-[21px] w-[21px]" />
      </a>
      <a href={site.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className={linkClass}>
        <FaFacebook className="h-[21px] w-[21px]" />
      </a>
      <a href={site.social.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className={linkClass}>
        <FaTiktok className="h-[21px] w-[21px]" />
      </a>
    </div>
  );
}

function Hours() {
  return (
    <>
      <span className="text-muted">{site.hours.days}</span>
      <span className="text-ink">[{site.hours.time}]</span>
    </>
  );
}

export default function Header() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTreatment, setActiveTreatment] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  // Desktop dropdown opens on hover; a short delay on leave lets the pointer
  // cross the gap between the bar and the panel without closing it.
  const openDropdown = () => {
    window.clearTimeout(closeTimer.current);
    setDropdownOpen(true);
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setDropdownOpen(false), 300);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    setScrollLocked(menuOpen);
    return () => {
      document.body.style.overflow = '';
      setScrollLocked(false);
    };
  }, [menuOpen]);

  const open = menuOpen || dropdownOpen;

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setDropdownOpen(false);
      setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Pages that open with a full-bleed photo keep the bar transparent until scrolled
  const heroPage =
    pathname === routes.home || findTreatmentPage(pathname.match(/^\/treatments\/([^/]+)/)?.[1]) !== undefined;
  const solid = scrolled || !heroPage;
  const barTone = open
    ? 'border-stone bg-cream'
    : solid
      ? 'border-cream/10 bg-cocoa/90 shadow-soft'
      : 'border-cream/35 bg-cream/10';
  const navText = open ? 'text-ink hover:text-muted' : 'text-cream hover:text-white';
  const ease = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-8 sm:pt-[31px] lg:px-10">
      {/* Café veil behind the open menu (colors from the Figma reference) */}
      <div
        aria-hidden
        className={`fixed inset-0 -z-10 bg-gradient-to-b from-[#A48A73]/70 to-[#5F4C3C]/80 backdrop-blur-[3px] transition-[opacity,visibility] duration-700 ${ease} ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      />
      <div ref={headerRef} className="relative mx-auto max-w-[1180px] animate-enter-down [animation-delay:150ms]">
        <div
          className={`flex items-center justify-between rounded-[18px] border py-2 pl-4 pr-2 backdrop-blur-md transition-colors duration-500 ${ease} sm:pl-6 ${barTone} ${
            menuOpen ? 'max-lg:rounded-b-none' : ''
          }`}
        >
          <Link to={routes.home} aria-label="BLOOM Beauty Skin — home">
            <Logo tone={open ? 'dark' : 'light'} />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-[35px] lg:flex">
            <button
              type="button"
              className={`-my-5 flex items-center gap-1.5 py-5 text-[13px] font-normal uppercase tracking-[0.03em] underline-offset-4 transition ${navText} ${
                dropdownOpen ? 'underline' : ''
              }`}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-controls="treatments-menu"
              onMouseEnter={openDropdown}
              onMouseLeave={scheduleClose}
              onClick={openDropdown}
            >
              Treatments
              <HiChevronDown className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`link-grow pb-0.5 text-[13px] font-normal uppercase tracking-[0.03em] ${navText}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to={routes.booking}
              className={`${open ? 'btn-dark' : 'btn-light'} px-5 py-2 font-serif text-lg font-normal italic sm:px-[26px] sm:py-2.5 sm:text-xl ${
                menuOpen ? 'max-lg:hidden' : ''
              }`}
            >
              Book now
            </Link>
            <button
              type="button"
              className={`grid h-11 w-11 place-items-center rounded-full transition lg:hidden ${
                open ? 'text-ink hover:bg-sand' : 'text-cream hover:bg-cream/10'
              }`}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <HiX className="h-6 w-6" /> : <HiOutlineMenuAlt4 className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Invisible hover bridge over the gap between the bar and the panel */}
        {dropdownOpen && (
          <div
            aria-hidden
            onMouseEnter={openDropdown}
            onMouseLeave={scheduleClose}
            className="absolute left-[83px] top-[calc(100%-12px)] hidden h-[22px] w-[840px] lg:block"
          />
        )}

        {/* Desktop treatments menu */}
        <div
          id="treatments-menu"
          onMouseEnter={openDropdown}
          onMouseLeave={scheduleClose}
          className={`absolute left-[83px] top-full mt-2.5 hidden w-[840px] overflow-hidden rounded-[20px] border border-stone bg-cream shadow-[0_40px_90px_rgba(35,27,21,0.34)] transition-[opacity,transform,visibility] duration-500 ${ease} lg:block ${
            dropdownOpen ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible -translate-y-1.5 opacity-0'
          }`}
        >
          <div className="flex gap-8 py-8 pl-[46px] pr-8">
            <div className="flex w-[262px] shrink-0 flex-col">
              <p className="text-[15px] text-muted">Treatments</p>
              <ul className="mt-6">
                {treatmentCategories.map((t, i) => (
                  <li
                    key={t.slug}
                    style={{ transitionDelay: dropdownOpen ? `${120 + i * 50}ms` : '0ms' }}
                    className={`transition-[opacity,transform] duration-500 ${ease} ${
                      dropdownOpen ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                    }`}
                  >
                    <Link
                      to={routes.treatment(t.slug)}
                      onMouseEnter={() => setActiveTreatment(i)}
                      onFocus={() => setActiveTreatment(i)}
                      className={`flex items-center gap-3 py-[9px] text-[21px] uppercase text-ink transition duration-500 ${ease} ${
                        activeTreatment === i ? 'font-medium' : ''
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`text-xs text-accent transition duration-500 ${ease} ${
                          activeTreatment === i ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                        }`}
                      >
                        ✦
                      </span>
                      <span className={`-ml-6 transition-transform duration-500 ${ease} ${activeTreatment === i ? 'translate-x-6' : ''}`}>
                        {t.shortTitle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <SocialLinks />
              </div>
            </div>
            <div className="relative h-[400px] flex-1 overflow-hidden rounded-2xl bg-sand">
              {treatmentCategories.map((t, i) => (
                <img
                  key={t.slug}
                  src={t.menuImage}
                  alt={i === activeTreatment ? t.shortTitle : ''}
                  aria-hidden={i !== activeTreatment}
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ${ease} ${
                    i === activeTreatment ? 'scale-100 opacity-100' : 'scale-[1.03] opacity-0'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-stone">
            <p className="flex items-center gap-4 whitespace-nowrap py-4 pl-[46px] pr-6 text-[15px]">
              <Hours />
            </p>
            <Link
              to={routes.booking}
              className="grid place-items-center border-l border-stone py-4 text-base text-ink transition hover:bg-sand"
            >
              Book now
            </Link>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          id="mobile-menu"
          data-lenis-prevent
          className={`absolute inset-x-0 top-full max-h-[calc(100dvh-96px)] overflow-y-auto rounded-b-[18px] border border-t-0 border-stone bg-cream shadow-soft transition-[opacity,transform,visibility] duration-500 ${ease} lg:hidden ${
            menuOpen ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible -translate-y-1.5 opacity-0'
          }`}
        >
          <div className="border-t border-stone px-[46px] pb-12 pt-8">
            <p className="text-[15px] text-muted">Treatments</p>
            <ul className="mt-6">
              {treatmentCategories.map((t, i) => (
                <li
                  key={t.slug}
                  style={{ transitionDelay: menuOpen ? `${150 + i * 60}ms` : '0ms' }}
                  className={`transition-[opacity,transform] duration-500 ${ease} ${
                    menuOpen ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0'
                  }`}
                >
                  <Link to={routes.treatment(t.slug)} className="block py-[9px] text-[22px] uppercase text-ink">
                    {t.shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <SocialLinks />
            </div>
          </div>
          <p className="flex items-center justify-between gap-4 border-t border-stone px-[18px] py-4 text-base">
            <Hours />
          </p>
          <Link
            to={routes.booking}
            className="block border-t border-stone py-4 text-center text-base text-ink transition hover:bg-sand"
          >
            Book now
          </Link>
        </div>
      </div>
    </header>
  );
}
