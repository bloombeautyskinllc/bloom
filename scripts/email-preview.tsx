/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * Renders an email template to HTML for visual checks (the cid: logo is swapped for a data URI so a
 * browser can show it) and optionally sends it through Resend to its test inbox.
 *   npx tsx scripts/email-preview.tsx <welcome|booking|staff> <out.html> [--send]
 */
import { writeFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { render } from '@react-email/components';
import { Resend } from 'resend';
import BookingEmail from '../src/emails/BookingEmail';
import { logoAttachment } from '../src/emails/EmailLayout';
import StaffEmail from '../src/emails/StaffEmail';
import WelcomeEmail from '../src/emails/WelcomeEmail';

const [template, out, flag] = process.argv.slice(2);

const templates: Record<string, ReactElement> = {
  welcome: <WelcomeEmail {...WelcomeEmail.PreviewProps} copy={{ ...WelcomeEmail.PreviewProps.copy, heading: 'Welcome to BLOOM, Luis.' }} />,
  booking: <BookingEmail {...BookingEmail.PreviewProps} />,
  staff: (
    <StaffEmail
      siteUrl="http://localhost:3000"
      address="305 E 204th St, Suite 2A, Bronx, NY 10467"
      preview="New booking · Maria Lopez · Tuesday, October 6, 2026 11:00 AM"
      heading="New booking"
      details={[
        ['Client', 'Maria Lopez'],
        ['Phone', '+12125550123'],
        ['Email', 'maria@example.com'],
        ['Treatment', 'Diode Laser Hair Removal Session\nUpper Lip, Underarms'],
        ['Date & time', 'Tuesday, October 6, 2026\n11:00 AM'],
        ['Duration', '25 min'],
        ['Price', 'from $95'],
        ['Reference', 'BLM-ABC123'],
        ['Your notes', 'Sensitive skin'],
        ['Payment', 'unpaid'],
      ]}
      cta={{ label: 'Open in the back office', href: 'http://localhost:3000/admin' }}
      footer="Staff notification from the BLOOM booking system."
    />
  ),
};

const email = templates[template];
if (!email || !out) {
  console.error(`Usage: npx tsx scripts/email-preview.tsx <${Object.keys(templates).join('|')}> <out.html> [--send]`);
  process.exit(1);
}

const html = await render(email);
writeFileSync(out, html.replaceAll(`cid:${logoAttachment.contentId}`, `data:image/png;base64,${logoAttachment.content}`));
console.log('rendered', out);

if (flag === '--send') {
  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.EMAIL_FROM!,
    to: 'delivered@resend.dev',
    subject: `Preview: ${template}`,
    react: email,
    attachments: [logoAttachment],
  });
  console.log(error ? `send failed: ${error.message}` : `sent via Resend: ${data?.id}`);
}
