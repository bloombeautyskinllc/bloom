import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import 'lenis/dist/lenis.css';
import '../index.css';

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BLOOM Beauty Skin',
  description:
    'BLOOM Beauty Skin — advanced cosmetology and clinical skin care in the Bronx, NY. Personalized facials, brows & lips, diode laser and intimate skin care.',
  icons: { icon: '/favicon.png' },
};

export const viewport: Viewport = {
  themeColor: '#31251B',
};

// Only the namespaces client components read: the rest (emails, back office) would otherwise be
// serialized into every page. The admin layout provides "bo" itself.
const CLIENT_NAMESPACES = ['login', 'onboarding', 'authModal', 'booking', 'dashboard', 'payment'] as const;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();
  const clientMessages = Object.fromEntries(CLIENT_NAMESPACES.map((ns) => [ns, messages[ns]]));

  return (
    // data-scroll-behavior: Next turns off the CSS smooth scroll while it resets the scroll on navigation,
    // otherwise those resets animate and land mid-page. suppressHydrationWarning (one level deep):
    // extensions such as ColorZilla add attributes to <body> before React hydrates.
    <html lang="en" data-scroll-behavior="smooth" className={`${serif.variable} ${sans.variable}`}>
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={clientMessages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
