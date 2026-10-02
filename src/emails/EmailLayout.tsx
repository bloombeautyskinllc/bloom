import type { ReactNode } from 'react';
import { Body, Container, Head, Html, Img, Link, Section, Text } from '@react-email/components';
import { LOGO_MARK_COCOA_PNG_BASE64, LOGO_MARK_SIZE } from './assets/logo';

const LOGO_CID = 'bloom-logo';

/** Inline attachment behind `cid:bloom-logo`. Every email that renders <EmailBrandHeader> must send it. */
export const logoAttachment = {
  filename: 'bloom-logo.png',
  content: LOGO_MARK_COCOA_PNG_BASE64,
  contentType: 'image/png',
  contentId: LOGO_CID,
};

// Brand tokens from tailwind.config.js. Email clients need inline hex values; most ignore web fonts,
// so the serif accent falls back to Georgia.
export const brand = {
  cream: '#FAF8F5',
  sand: '#F4EFEA',
  stone: '#E4DCD2',
  cocoa: '#31251B',
  ink: '#231B15',
  muted: '#5E4F41',
  bronze: '#725F4C',
  serif: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
  sans: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
};

// Mark + "BLOOM / BEAUTY SKIN" wordmark, like the site header. The PNG is 2x, shown at half size for sharp screens.
export function EmailBrandHeader({ siteUrl }: { siteUrl: string }) {
  return (
    <Section style={{ textAlign: 'center', paddingBottom: 8 }}>
      <Link href={siteUrl} style={{ textDecoration: 'none' }}>
        <Img
          src={`cid:${LOGO_CID}`}
          alt="BLOOM Beauty Skin"
          width={Math.round(LOGO_MARK_SIZE.width / 2)}
          height={Math.round(LOGO_MARK_SIZE.height / 2)}
          style={{ margin: '0 auto' }}
        />
        <Text style={{ margin: '10px 0 0', fontFamily: brand.serif, fontSize: 20, letterSpacing: '0.32em', color: brand.ink, lineHeight: '22px' }}>
          BLOOM
        </Text>
        <Text style={{ margin: '4px 0 0', fontFamily: brand.sans, fontSize: 8, letterSpacing: '0.12em', color: brand.ink, lineHeight: '10px' }}>
          BEAUTY SKIN
        </Text>
      </Link>
    </Section>
  );
}

export default function EmailLayout({ children, footer, address }: { children: ReactNode; footer: string; address: string }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={{ backgroundColor: brand.sand, fontFamily: brand.sans, margin: 0, padding: '32px 12px' }}>
        <Container style={{ backgroundColor: brand.cream, borderRadius: 22, maxWidth: 560, padding: '36px 32px', border: `1px solid ${brand.stone}` }}>
          {children}
        </Container>
        <Container style={{ maxWidth: 560, padding: '16px 32px' }}>
          <Text style={{ fontSize: 12, lineHeight: '18px', color: brand.bronze, textAlign: 'center', margin: 0 }}>
            {footer}
            <br />
            BLOOM Beauty Skin · {address}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
