'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import ScrollManager from './ScrollManager';
import ContactProvider from './ContactProvider';
import ScrollProgress from '../decor/ScrollProgress';
import AuthModalProvider from '../auth/AuthModalProvider';
import type { Contact } from '@/lib/contact';

/** `contact`: phone, WhatsApp, email and address from admin > Settings, loaded by the layout */
export default function SiteShell({ contact, children }: { contact: Contact; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ContactProvider contact={contact}>
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
    </ContactProvider>
  );
}
