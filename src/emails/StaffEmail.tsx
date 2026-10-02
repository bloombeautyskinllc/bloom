import { Preview } from '@react-email/components';
import EmailLayout, { EmailBrandHeader } from './EmailLayout';
import { DetailsTable, EmailButton, EmailHeading, Paragraph } from './parts';

export type StaffEmailProps = {
  siteUrl: string;
  address: string;
  preview: string;
  heading: string;
  intro?: string;
  details: [string, string][];
  cta: { label: string; href: string };
  footer: string;
};

/** Internal notifications: new/rescheduled/cancelled bookings and failing background tasks */
export default function StaffEmail({ siteUrl, address, preview, heading, intro, details, cta, footer }: StaffEmailProps) {
  return (
    <EmailLayout footer={footer} address={address}>
      <Preview>{preview}</Preview>
      <EmailBrandHeader siteUrl={siteUrl} />
      <EmailHeading>{heading}</EmailHeading>
      {intro && <Paragraph style={{ textAlign: 'center' }}>{intro}</Paragraph>}
      <DetailsTable rows={details} />
      <EmailButton href={cta.href}>{cta.label}</EmailButton>
    </EmailLayout>
  );
}
