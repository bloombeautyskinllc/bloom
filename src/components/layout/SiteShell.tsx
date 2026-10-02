'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import ScrollManager from './ScrollManager';
import ScrollProgress from '../decor/ScrollProgress';
import AuthModalProvider from '../auth/AuthModalProvider';

export default function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthModalProvider>
      <ScrollManager />
      <ScrollProgress />
      <Header />
      {/* Keyed by route so every page change fades in and replays its entrance animations */}
      <main key={pathname} className="animate-page-in">
        {children}
      </main>
      <Footer />
    </AuthModalProvider>
  );
}
