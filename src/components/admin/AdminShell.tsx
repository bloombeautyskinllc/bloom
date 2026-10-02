'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { IconType } from 'react-icons';
import {
  HiOutlineCalendar,
  HiOutlineClipboardList,
  HiOutlineCog,
  HiOutlineCollection,
  HiOutlineExternalLink,
  HiOutlineFingerPrint,
  HiOutlineHome,
  HiOutlineMenuAlt4,
  HiOutlinePlusCircle,
  HiOutlineUserGroup,
  HiOutlineUsers,
  HiX,
} from 'react-icons/hi';
import Logo from '@/components/ui/Logo';
import { signOut } from '@/lib/auth/actions';
import { cn } from '@/lib/utils';

type Item = { href: string; key: string; icon: IconType; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: '/admin', key: 'dashboard', icon: HiOutlineHome },
  { href: '/admin/calendar', key: 'calendar', icon: HiOutlineCalendar },
  { href: '/admin/bookings', key: 'bookings', icon: HiOutlineClipboardList },
  { href: '/admin/bookings/new', key: 'newBooking', icon: HiOutlinePlusCircle },
  { href: '/admin/clients', key: 'clients', icon: HiOutlineUsers },
  { href: '/admin/catalog', key: 'catalog', icon: HiOutlineCollection, adminOnly: true },
  { href: '/admin/team', key: 'team', icon: HiOutlineUserGroup, adminOnly: true },
  { href: '/admin/settings', key: 'settings', icon: HiOutlineCog, adminOnly: true },
  { href: '/admin/activity', key: 'activity', icon: HiOutlineFingerPrint, adminOnly: true },
];

// Longest matching prefix wins, so /admin/bookings/new highlights "New booking", not "Bookings"
function activeHref(pathname: string, items: Item[]) {
  return items
    .filter((i) => pathname === i.href || (i.href !== '/admin' && pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export default function AdminShell({ children, name, role }: { children: ReactNode; name: string; role: 'admin' | 'staff' }) {
  const t = useTranslations('bo.nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => !i.adminOnly || role === 'admin');
  const current = activeHref(pathname, items);

  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label={t('title')} className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
              active ? 'bg-cream/10 font-medium text-cream' : 'text-cream/70 hover:bg-cream/5 hover:text-cream',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-cream/10 px-6 py-5 text-sm">
      <p className="truncate text-cream">{name}</p>
      <p className="text-xs uppercase tracking-[0.14em] text-cream/50">{t(`role.${role}`)}</p>
      <div className="mt-4 flex flex-col gap-2">
        <Link href="/" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream">
          <HiOutlineExternalLink className="h-4 w-4" /> {t('viewSite')}
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-cream/70 hover:text-cream">
            {t('signOut')}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-cocoa lg:flex">
        <div className="px-6 pb-6 pt-7">
          <Link href="/admin" aria-label={t('title')}>
            <Logo />
          </Link>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-cocoa px-4 py-3 lg:hidden">
        <Link href="/admin" aria-label={t('title')}>
          <Logo className="scale-90" />
        </Link>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('menu')} className="grid h-10 w-10 place-items-center rounded-full text-cream hover:bg-cream/10">
          {open ? <HiX className="h-6 w-6" /> : <HiOutlineMenuAlt4 className="h-6 w-6" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[64px] z-30 flex flex-col overflow-y-auto bg-cocoa pt-3 lg:hidden" data-lenis-prevent>
          {nav}
          {footer}
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
