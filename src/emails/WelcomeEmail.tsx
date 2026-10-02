import { Button, Heading, Hr, Preview, Section, Text } from '@react-email/components';
import EmailLayout, { brand, EmailBrandHeader } from './EmailLayout';

export type WelcomeEmailProps = {
  siteUrl: string;
  bookingUrl: string;
  copy: {
    preview: string;
    heading: string;
    body: string;
    cta: string;
    signoff: string;
    team: string;
    footer: string;
  };
  address: string;
};

export default function WelcomeEmail({ siteUrl, bookingUrl, copy, address }: WelcomeEmailProps) {
  return (
    <EmailLayout footer={copy.footer} address={address}>
      <Preview>{copy.preview}</Preview>
      <EmailBrandHeader siteUrl={siteUrl} />
      <Heading as="h1" style={styles.heading}>
        {copy.heading}
      </Heading>
      <Text style={styles.text}>{copy.body}</Text>
      <Section style={{ textAlign: 'center', padding: '12px 0 20px' }}>
        <Button href={bookingUrl} style={styles.button}>
          {copy.cta}
        </Button>
      </Section>
      <Hr style={{ borderColor: brand.stone, margin: '8px 0 20px' }} />
      <Text style={{ ...styles.text, marginBottom: 0 }}>{copy.signoff}</Text>
      <Text style={{ ...styles.text, marginTop: 0, fontFamily: brand.serif, fontStyle: 'italic', fontSize: 18 }}>
        {copy.team}
      </Text>
    </EmailLayout>
  );
}

const styles = {
  heading: {
    fontFamily: brand.serif,
    fontWeight: 400,
    fontSize: 32,
    lineHeight: '38px',
    color: brand.ink,
    textAlign: 'center' as const,
    margin: '16px 0 12px',
  },
  text: { fontSize: 15, lineHeight: '24px', color: brand.muted },
  button: {
    backgroundColor: brand.cocoa,
    color: brand.cream,
    borderRadius: 999,
    padding: '14px 28px',
    fontFamily: brand.serif,
    fontStyle: 'italic',
    fontSize: 18,
    textDecoration: 'none',
  },
};

WelcomeEmail.PreviewProps = {
  siteUrl: 'http://localhost:3000',
  bookingUrl: 'http://localhost:3000/booking',
  address: '305 E 204th St, Suite 2A, Bronx, NY 10467',
  copy: {
    preview: 'Your account is ready.',
    heading: 'Welcome to BLOOM, Alice.',
    body: 'Your account is ready. From now on you can book, reschedule or cancel your appointments online.',
    cta: 'Book your appointment',
    signoff: 'See you soon,',
    team: 'The BLOOM Beauty Skin team',
    footer: 'You’re receiving this email because you created an account at BLOOM Beauty Skin.',
  },
} satisfies WelcomeEmailProps;
