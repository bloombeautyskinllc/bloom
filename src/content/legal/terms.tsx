import Link from 'next/link';
import type { LegalSection } from '@/components/legal/LegalPage';
import { routes } from '@/data/site';
import type { PublicSettings } from '@/lib/settings';

const hours = (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'}`;
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

function refundText(percent: number) {
  if (percent >= 100) return 'a full refund of the amount you paid';
  if (percent <= 0) return 'no refund';
  return `a refund of ${percent}% of the amount you paid`;
}

export function termsSections(s: PublicSettings): LegalSection[] {
  const address = [s.address_line1, s.address_line2].filter(Boolean).join(', ');
  const contactEmail = s.public_email ?? s.privacy_email;
  const retained = 100 - s.cancellation_refund_percent;

  return [
    {
      id: 'agreement',
      title: 'About these terms',
      body: (
        <>
          <p>
            These terms apply when you use the {s.business_name} website, create an account, book an appointment or
            receive a treatment from <strong>{s.legal_name}</strong> (“BLOOM”, “we”, “us”), {address}. By creating an
            account or booking, you agree to them and to our <Link href={routes.privacy}>Privacy policy</Link>.
          </p>
        </>
      ),
    },
    {
      id: 'eligibility',
      title: 'Accounts and eligibility',
      body: (
        <>
          <p>
            You must be 18 or older to create an account. You sign in with Google and agree to give us accurate
            contact details and keep them up to date. You are responsible for activity in your account; tell us right
            away if you believe someone else has accessed it.
          </p>
          {s.minors_allowed_with_guardian ? (
            <p>
              <strong>Minors.</strong> Clients under 18 may receive treatments only with the consent of a parent or
              legal guardian, who books through their own account, accompanies the minor during the appointment and
              signs any required consent forms. Some treatments may not be available to minors; your specialist will
              confirm before treatment.
            </p>
          ) : (
            <p>
              <strong>Minors.</strong> Our treatments are available only to clients 18 and older.
            </p>
          )}
        </>
      ),
    },
    {
      id: 'bookings',
      title: 'Bookings and confirmation',
      body: (
        <>
          <p>
            When you choose a time, we hold it for you for {s.hold_minutes} minutes while you complete your booking.
            <strong> Your appointment is confirmed once your payment is received</strong>; if the payment is not
            completed in time, the slot is released. You will receive a confirmation email with your appointment
            details.
          </p>
          <p>
            We may occasionally need to move or cancel an appointment (for example, if your specialist is unwell).
            If we do, we will contact you as soon as possible and offer you a new time or a full refund.
          </p>
        </>
      ),
    },
    {
      id: 'prices-payments',
      title: 'Prices and payments',
      body: (
        <>
          <p>
            Prices are shown in US dollars on our website. Prices marked “+” or “from” are starting prices: your final
            protocol and price are confirmed with your specialist during your consultation, and any difference is paid
            at the studio.
          </p>
          <p>
            Online payments are processed securely by Stripe. The price of a confirmed appointment does not change if
            we update our prices afterwards.
          </p>
        </>
      ),
    },
    {
      id: 'cancellation',
      title: 'Cancellation and rescheduling policy',
      body: (
        <>
          <h3>Rescheduling</h3>
          <p>
            You can reschedule from your account up to {hours(s.reschedule_cutoff_hours)} before your appointment,
            subject to availability. Each booking can be rescheduled up to {times(s.max_reschedules)}.
          </p>
          <h3>Cancelling with notice</h3>
          <p>
            If you cancel at least {hours(s.cancel_cutoff_hours)} before your appointment, you will receive{' '}
            {refundText(s.cancellation_refund_percent)}
            {retained > 0 && retained < 100 && (
              <> ({retained}% is retained to cover payment processing and the time reserved for you)</>
            )}
            , returned to your original payment method.
          </p>
          <h3>Late cancellations and missed appointments</h3>
          <p>
            If you cancel less than {hours(s.cancel_cutoff_hours)} before your appointment or do not attend (“no-show”),{' '}
            {s.late_cancellation_refund_percent <= 0
              ? 'the amount you paid is non-refundable.'
              : <>you will receive {refundText(s.late_cancellation_refund_percent)}.</>}
          </p>
          <h3>Arriving late</h3>
          <p>
            Please arrive a few minutes early. If you arrive late, we may need to shorten your treatment so the next
            client is not delayed; the price stays the same.
          </p>
          <p>
            Refunds usually appear on your statement within 5 to 10 business days, depending on your bank. If you
            cannot change your appointment online because it is inside the notice period, contact us and we will do
            our best to help.
          </p>
        </>
      ),
    },
    {
      id: 'health-safety',
      title: 'Health, consent and results',
      body: (
        <>
          <p>
            Some treatments require an intake or consent form. You agree to answer it completely and truthfully and
            to tell us about any change in your health, medications, allergies, pregnancy or recent sun exposure
            before your appointment. Your specialist may postpone, adjust or decline a treatment when it would not be
            safe or suitable for you; in that case you may reschedule or receive a refund for the treatment not
            performed.
          </p>
          <p>
            Our services are cosmetic and are not a substitute for medical advice. Results vary from person to person
            and depend on following the aftercare instructions we give you; we cannot guarantee a specific result.
          </p>
        </>
      ),
    },
    {
      id: 'communications',
      title: 'Messages we send',
      body: (
        <p>
          We will email you about your account and appointments (confirmations, changes, cancellations and receipts).
          Reminders before your appointment are optional and you can turn them off at any time from your account.
        </p>
      ),
    },
    {
      id: 'website',
      title: 'Using our website',
      body: (
        <p>
          Please do not misuse our website, for example by attempting to access other people’s accounts, interfering
          with its operation or booking appointments you do not intend to attend. The content of this website,
          including text, photos and our brand, belongs to {s.legal_name} and may not be copied without permission.
        </p>
      ),
    },
    {
      id: 'liability',
      title: 'Liability',
      body: (
        <p>
          To the fullest extent permitted by law, {s.legal_name} is not liable for indirect or consequential losses,
          and our total liability for any claim related to a booking is limited to the amount you paid for that
          booking. Nothing in these terms limits any liability that cannot be limited under applicable law, or your
          rights as a consumer.
        </p>
      ),
    },
    {
      id: 'law',
      title: 'Governing law',
      body: <p>These terms are governed by the laws of the State of New York.</p>,
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      body: (
        <p>
          We may update these terms. The version that applies to an appointment is the one in effect when you booked
          it. If we make significant changes, we will ask you to accept the new terms the next time you book.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact us',
      body: (
        <p>
          {s.legal_name}, {address}. Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      ),
    },
  ];
}
