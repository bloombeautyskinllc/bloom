import type { LegalSection } from '@/components/legal/LegalPage';
import type { PublicSettings } from '@/lib/settings';

// Bump when the text changes materially (shown as "Last updated")
export const PRIVACY_UPDATED = '2026-10-02';

export function privacySections(s: PublicSettings): LegalSection[] {
  const address = [s.address_line1, s.address_line2].filter(Boolean).join(', ');
  const email = (
    <a href={`mailto:${s.privacy_email}`}>{s.privacy_email}</a>
  );

  return [
    {
      id: 'who-we-are',
      title: 'Who we are',
      body: (
        <>
          <p>
            {s.business_name} is operated by <strong>{s.legal_name}</strong> (“BLOOM”, “we”, “us”), an advanced
            cosmetology and clinical skin care studio located at {address}.
          </p>
          <p>
            This policy explains what personal information we collect when you visit our website, create an account,
            book an appointment or receive a treatment, how we use it, and the choices you have. For any privacy
            question or request, write to {email}.
          </p>
        </>
      ),
    },
    {
      id: 'information-we-collect',
      title: 'Information we collect',
      body: (
        <>
          <h3>Account information</h3>
          <p>
            You sign in with your Google account. Google shares with us your name, email address, profile photo and
            a unique account identifier. We do not receive your Google password.
          </p>
          <h3>Contact details and preferences</h3>
          <p>
            Your mobile phone number, whether you want appointment reminders, and your acceptance of our Terms of
            service and cancellation policy.
          </p>
          <h3>Appointment information</h3>
          <p>
            The treatments and options you book, dates and times, notes you leave for your specialist, price, payment
            status and your appointment history (including cancellations and missed appointments).
          </p>
          <h3>Health and consent information</h3>
          <p>
            Some treatments require an intake or consent form before we can perform them safely, for example your skin
            type, medications, allergies, recent sun exposure or relevant medical conditions, and your signed consent.
            We treat this as <strong>sensitive information</strong>: we collect it only with your consent and only to
            assess whether a treatment is suitable and safe for you.
          </p>
          <h3>Payment information</h3>
          <p>
            Payments are processed by Square. Your card details go directly to Square and are never stored on our
            systems; we only receive the payment status, amount and a reference.
          </p>
          <h3>Google Calendar (optional)</h3>
          <p>
            If you choose to connect your Google Calendar, we request permission to create, update and delete the
            calendar events for your BLOOM appointments. We do not use this access for any other purpose. You can
            use our service without connecting your calendar; we will email you calendar invitations instead.
          </p>
          <h3>Technical information</h3>
          <p>
            When you use our website we record your IP address, browser type and the date and time of actions you
            take in your account. We use this to keep your account secure and to maintain an activity log of changes
            to bookings and accounts.
          </p>
        </>
      ),
    },
    {
      id: 'how-we-use-it',
      title: 'How we use your information',
      body: (
        <>
          <ul>
            <li>To create and manage your account and verify your identity when you sign in.</li>
            <li>To book, confirm, reschedule and cancel your appointments, and to process payments and refunds.</li>
            <li>
              To send you service messages: booking confirmations, changes, cancellations, payment receipts and, if
              you opt in, reminders before your appointment.
            </li>
            <li>To assess whether a treatment is suitable and safe for you, and to keep a record of your treatments.</li>
            <li>To contact you about your appointment if something changes.</li>
            <li>To protect our clients and our business: security, fraud prevention and an audit trail of account and booking activity.</li>
            <li>To comply with legal, tax and accounting obligations.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal information, and we do not use it for targeted advertising.
          </p>
        </>
      ),
    },
    {
      id: 'google-user-data',
      title: 'Google user data',
      body: (
        <>
          <p>
            We use the information we receive from Google only to sign you in and, if you connect your calendar, to
            keep your BLOOM appointments in your Google Calendar. We do not use Google user data to develop, improve
            or train generalized artificial intelligence or machine learning models, and we do not transfer it to
            third parties except as needed to provide these features, to comply with the law, or with your consent.
          </p>
          <p>
            {s.business_name}’s use and transfer of information received from Google APIs will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p>
            You can remove our access at any time from your{' '}
            <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
              Google account settings
            </a>{' '}
            or from your BLOOM profile.
          </p>
        </>
      ),
    },
    {
      id: 'sharing',
      title: 'Who we share it with',
      body: (
        <>
          <p>We share personal information only with service providers that help us run our business, under contracts that limit their use of it:</p>
          <ul>
            <li><strong>Supabase</strong>: secure database, file storage and sign-in.</li>
            <li><strong>Vercel</strong>: website hosting.</li>
            <li><strong>Google</strong>: sign-in and, if you connect it, Google Calendar.</li>
            <li><strong>Resend</strong>: delivery of our emails.</li>
            <li><strong>Square</strong>: payment processing.</li>
          </ul>
          <p>
            We may also disclose information when required by law or to protect the rights, property or safety of our
            clients, our team or others, and to a successor if our business is sold or merged, in which case this
            policy will continue to apply.
          </p>
        </>
      ),
    },
    {
      id: 'cookies',
      title: 'Cookies',
      body: (
        <p>
          We use only essential cookies that keep you signed in and protect your account. We do not use advertising
          or third-party tracking cookies. If we ever add analytics, we will update this policy first.
        </p>
      ),
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      body: (
        <>
          <p>
            We keep your account information while your account is active. Appointment, treatment, consent and payment
            records are kept for as long as needed to provide our services and to meet our legal, tax and professional
            record-keeping obligations.
          </p>
          <p>
            When you delete your account, we remove or anonymize the information that identifies you. We keep
            de-identified records of past appointments and payments, and our security activity log, where the law
            requires or allows it.
          </p>
        </>
      ),
    },
    {
      id: 'your-choices',
      title: 'Your rights and choices',
      body: (
        <>
          <ul>
            <li><strong>Access and correction</strong>: see and edit your name, phone and preferences from your account.</li>
            <li><strong>Reminders</strong>: turn appointment reminders on or off at any time.</li>
            <li><strong>Google Calendar</strong>: connect or disconnect it whenever you like.</li>
            <li><strong>Deletion</strong>: delete your account from your profile or by writing to us.</li>
            <li><strong>A copy of your data</strong>: ask us for a copy of the personal information we hold about you.</li>
          </ul>
          <p>
            To make a request, write to {email} from the email address on your account. We may need to verify your
            identity, and we will respond within 30 days.
          </p>
        </>
      ),
    },
    {
      id: 'security',
      title: 'How we protect it',
      body: (
        <p>
          Data is encrypted in transit, access to client records is limited to authorized staff according to their
          role, sensitive access tokens are stored encrypted, and changes to accounts and bookings are recorded in an
          activity log. No system is completely secure; if a breach affects your personal information, we will notify
          you as required by New York law.
        </p>
      ),
    },
    {
      id: 'minors',
      title: 'Minors',
      body: (
        <p>
          {s.minors_allowed_with_guardian
            ? 'Accounts are for adults 18 and older. A parent or legal guardian may book a treatment for a minor through their own account; the minor must attend with the parent or guardian, who provides the required consent. We do not knowingly collect personal information directly from children under 13.'
            : 'Our services and accounts are for adults 18 and older. We do not knowingly collect personal information from minors.'}
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: (
        <p>
          We may update this policy from time to time. We will post the new version here with a new “Last updated”
          date and, if the changes are significant, we will let you know by email or when you next sign in.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact us',
      body: (
        <p>
          {s.legal_name}, {address}. Email: {email}.
        </p>
      ),
    },
  ];
}
