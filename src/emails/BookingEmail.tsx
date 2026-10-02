import { Preview } from '@react-email/components';
import EmailLayout, { EmailBrandHeader } from './EmailLayout';
import { DetailsTable, EmailButton, EmailHeading, Paragraph, emailStyles } from './parts';

export type BookingEmailProps = {
  siteUrl: string;
  address: string;
  preview: string;
  heading: string;
  intro: string;
  details: [string, string][];
  footnote?: string;
  cta?: { label: string; href: string };
  footer: string;
};

/** Client emails: confirmed, rescheduled, cancelled, reminder (the copy decides which) */
export default function BookingEmail({ siteUrl, address, preview, heading, intro, details, footnote, cta, footer }: BookingEmailProps) {
  return (
    <EmailLayout footer={footer} address={address}>
      <Preview>{preview}</Preview>
      <EmailBrandHeader siteUrl={siteUrl} />
      <EmailHeading>{heading}</EmailHeading>
      <Paragraph style={{ textAlign: 'center' }}>{intro}</Paragraph>
      <DetailsTable rows={details} />
      {cta && <EmailButton href={cta.href}>{cta.label}</EmailButton>}
      {footnote && <Paragraph style={emailStyles.small}>{footnote}</Paragraph>}
    </EmailLayout>
  );
}

BookingEmail.PreviewProps = {
  siteUrl: 'http://localhost:3000',
  address: '305 E 204th St, Suite 2A, Bronx, NY 10467',
  preview: 'See you Tuesday, October 6 at 11:00 AM.',
  heading: 'You’re booked, Maria.',
  intro: 'We’re looking forward to seeing you. Here are your appointment details.',
  details: [
    ['Treatment', 'Diode Laser Hair Removal Session\nUpper Lip, Underarms'],
    ['Date & time', 'Tuesday, October 6, 2026\n11:00 AM'],
    ['Duration', '25 min'],
    ['Price', 'from $95'],
    ['Where', '305 E 204th St, Suite 2A, Bronx, NY 10467'],
    ['Reference', 'BLM-ABC123'],
  ],
  footnote: 'Starting price. Your final price is confirmed at your consultation. The attached invitation adds it to your calendar.',
  cta: { label: 'Manage your appointment', href: 'http://localhost:3000/dashboard' },
  footer: 'You’re receiving this email because you have an appointment with BLOOM Beauty Skin.',
} satisfies BookingEmailProps;
