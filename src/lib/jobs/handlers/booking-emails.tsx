import 'server-only';
import { createTranslator } from 'next-intl';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { z } from 'zod';
import { routes, site } from '@/data/site';
import BookingEmail from '@/emails/BookingEmail';
import { logoAttachment } from '@/emails/EmailLayout';
import StaffEmail from '@/emails/StaffEmail';
import { defaultLocale, loadMessages, locales, type Locale } from '@/i18n/config';
import { addDays, localDate } from '@/lib/availability/timezone';
import { bookingCalendarEvent } from '@/lib/booking/calendar-event';
import { formatDateLong, formatDuration, formatMoney, formatTime } from '@/lib/booking/format';
import { loadBooking, staffRecipients, type BookingDetails } from '@/lib/booking/load';
import { buildIcs } from '@/lib/calendar/ics';
import { env } from '@/lib/env';
import { firstName } from '@/lib/format/name';
import { sendEmail } from '@/lib/notifications/email';
import { getPublicSettings } from '@/lib/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Job } from '../types';

const ADDRESS = `${site.address.line1}, ${site.address.line2}`;

async function translator(locale: string) {
  const l: Locale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  return createTranslator({ locale: l, messages: await loadMessages(l), namespace: 'email' });
}

function detailRows(b: BookingDetails, t: Awaited<ReturnType<typeof translator>>, timeZone: string, withNotes: boolean): [string, string][] {
  const treatment = b.optionNames.length ? `${b.treatmentName}\n${b.optionNames.join(', ')}` : b.treatmentName;
  const minutes = (Date.parse(b.endAt) - Date.parse(b.startAt)) / 60_000;
  const rows: [string, string][] = [
    [t('details.treatment'), treatment],
    [t('details.when'), `${formatDateLong(b.startAt, timeZone)}\n${formatTime(b.startAt, timeZone)}`],
    [t('details.duration'), formatDuration(minutes)],
    [t('details.total'), `${b.isStartingPrice ? 'from ' : ''}${formatMoney(b.totalCents)}`],
    ...(b.amountPaidCents > 0 ? [[t('details.paid'), formatMoney(b.amountPaidCents)] as [string, string]] : []),
    [t('details.where'), ADDRESS],
    [t('details.reference'), b.code],
  ];
  if (withNotes && b.clientNotes) rows.push([t('details.notes'), b.clientNotes]);
  return rows;
}

function icsAttachment(b: BookingDetails, cancelled = false) {
  const event = bookingCalendarEvent(
    {
      id: b.id,
      code: b.code,
      start_at: b.startAt,
      end_at: b.endAt,
      // A cancellation must carry a higher SEQUENCE than the last invitation to replace it
      reschedule_count: b.rescheduleCount + (cancelled ? 1 : 0),
      status: cancelled ? 'cancelled' : 'confirmed',
      items: [{ kind: 'treatment', name: b.treatmentName }, ...b.optionNames.map((name) => ({ kind: 'option', name }))],
    },
    env.NEXT_PUBLIC_SITE_URL,
  );
  return { filename: `bloom-${b.code}.ics`, content: buildIcs(event), contentType: `text/calendar; charset=utf-8; method=${cancelled ? 'CANCEL' : 'PUBLISH'}` };
}

// -----------------------------------------------------------------------------
// Client: confirmed / rescheduled / cancelled
// -----------------------------------------------------------------------------
const bookingPayload = z.object({ booking_id: z.uuid(), event: z.enum(['confirmed', 'rescheduled', 'cancelled']), by: z.enum(['client', 'business']).default('client') });

export async function bookingEmail(job: Job) {
  const { booking_id, event, by } = bookingPayload.parse(job.payload);
  const b = await loadBooking(booking_id);
  if (!b || b.client.gone || !b.client.email) return;
  // A confirmation that was overtaken by a cancellation is not sent (the cancellation email is)
  if (event !== 'cancelled' && b.status !== 'confirmed') return;

  const { timezone } = await getPublicSettings();
  const t = await translator(b.client.locale);
  const key = event === 'cancelled' ? (`cancelled_${by}` as const) : event;
  const vars = { name: firstName(b.client.name), date: formatDateLong(b.startAt, timezone), time: formatTime(b.startAt, timezone) };
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;

  await sendEmail({
    to: b.client.email,
    subject: t(`booking.${key}.subject`, vars),
    template: `booking.${key}`,
    profileId: b.client.id,
    bookingId: b.id,
    jobId: job.id,
    idempotencyKey: `job/${job.id}`,
    attachments: [logoAttachment, icsAttachment(b, event === 'cancelled')],
    react: (
      <BookingEmail
        siteUrl={siteUrl}
        address={ADDRESS}
        preview={t(`booking.${key}.preview`, vars)}
        heading={t(`booking.${key}.heading`, vars)}
        intro={t(`booking.${key}.intro`)}
        details={[
          ...detailRows(b, t, timezone, event !== 'cancelled'),
          ...(event === 'cancelled' && b.refundDueCents ? [[t('details.refund'), t('details.refundValue', { amount: formatMoney(b.refundDueCents) })] as [string, string]] : []),
        ]}
        footnote={event === 'cancelled' ? undefined : [b.isStartingPrice ? t('details.startingPrice') : null, t('addToCalendar')].filter(Boolean).join(' ')}
        cta={event === 'cancelled' ? { label: t('booking.bookAgain'), href: `${siteUrl}${routes.booking}` } : { label: t('manage'), href: `${siteUrl}${routes.dashboard}` }}
        footer={t('footer')}
      />
    ),
  });
}

// -----------------------------------------------------------------------------
// Client: reminders (24h / 2h, configurable)
// -----------------------------------------------------------------------------
const reminderPayload = z.object({ booking_id: z.uuid(), start_at: z.string(), offset_min: z.number() });

export async function reminderEmail(job: Job) {
  const { booking_id, start_at } = reminderPayload.parse(job.payload);
  const b = await loadBooking(booking_id);
  // Skip if cancelled, moved (a new reminder exists for the new time), opted out or already started
  if (!b || b.client.gone || !b.client.email || !b.client.remindersOptIn) return;
  if (b.status !== 'confirmed' || Date.parse(b.startAt) !== Date.parse(start_at) || Date.parse(b.startAt) <= Date.now()) return;

  const { timezone } = await getPublicSettings();
  const t = await translator(b.client.locale);
  const today = localDate(Date.now(), timezone);
  const day = localDate(Date.parse(b.startAt), timezone);
  const time = formatTime(b.startAt, timezone);
  const when = day === today ? `today at ${time}` : day === addDays(today, 1) ? `tomorrow at ${time}` : `on ${formatDateLong(b.startAt, timezone)} at ${time}`;
  const vars = { name: firstName(b.client.name), when };

  await sendEmail({
    to: b.client.email,
    subject: t('booking.reminder.subject', vars),
    template: 'booking.reminder',
    profileId: b.client.id,
    bookingId: b.id,
    jobId: job.id,
    idempotencyKey: `job/${job.id}`,
    attachments: [logoAttachment],
    react: (
      <BookingEmail
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        address={ADDRESS}
        preview={t('booking.reminder.preview', vars)}
        heading={t('booking.reminder.heading', vars)}
        intro={t('booking.reminder.intro')}
        details={detailRows(b, t, timezone, false)}
        cta={{ label: t('manage'), href: `${env.NEXT_PUBLIC_SITE_URL}${routes.dashboard}` }}
        footer={t('footer')}
      />
    ),
  });
}

// -----------------------------------------------------------------------------
// Client: review request after the visit
// -----------------------------------------------------------------------------
const reviewPayload = z.object({ booking_id: z.uuid(), start_at: z.string() });

export async function reviewRequestEmail(job: Job) {
  const { booking_id, start_at } = reviewPayload.parse(job.payload);
  const b = await loadBooking(booking_id);
  if (!b || b.client.gone || !b.client.email) return;
  if (!['confirmed', 'completed'].includes(b.status) || Date.parse(b.startAt) !== Date.parse(start_at)) return;

  const { data: settings } = await createAdminClient().from('business_settings').select('review_url').eq('id', 1).single();
  if (!settings?.review_url) return;

  const t = await translator(b.client.locale);
  const vars = { name: firstName(b.client.name), treatment: b.treatmentName };
  await sendEmail({
    to: b.client.email,
    subject: t('review.subject'),
    template: 'review_request',
    profileId: b.client.id,
    bookingId: b.id,
    jobId: job.id,
    idempotencyKey: `job/${job.id}`,
    attachments: [logoAttachment],
    react: (
      <BookingEmail
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        address={ADDRESS}
        preview={t('review.preview', vars)}
        heading={t('review.heading', vars)}
        intro={t('review.intro', vars)}
        details={[]}
        cta={{ label: t('review.cta'), href: settings.review_url }}
        footer={t('footer')}
      />
    ),
  });
}

// -----------------------------------------------------------------------------
// Staff: new / rescheduled / cancelled
// -----------------------------------------------------------------------------
export async function staffBookingEmail(job: Job) {
  const { booking_id, event, by } = bookingPayload.parse(job.payload);
  const b = await loadBooking(booking_id);
  const to = await staffRecipients();
  if (!b || to.length === 0) return;

  const { timezone } = await getPublicSettings();
  const t = await translator(defaultLocale);
  const kind = event === 'confirmed' ? 'new' : event;
  const vars = { client: b.client.name ?? 'Client', date: `${formatDateLong(b.startAt, timezone)} ${formatTime(b.startAt, timezone)}` };
  const adminUrl = `${env.NEXT_PUBLIC_SITE_URL}${routes.admin}?booking=${b.code}`;

  const details: [string, string][] = [
    [t('admin.client'), b.client.name ?? '—'],
    [t('admin.phone'), (b.client.phone && parsePhoneNumberFromString(b.client.phone)?.formatInternational()) ?? b.client.phone ?? '—'],
    [t('admin.email'), b.client.email ?? '—'],
    ...detailRows(b, t, timezone, true)
      .filter(([label]) => label !== t('details.where'))
      .map(([label, value]): [string, string] => [label === t('details.notes') ? t('admin.notes') : label, value]),
    [t('admin.payment'), t(`admin.paymentStatus.${b.paymentStatus}`)],
  ];
  if (event === 'cancelled') {
    details.push([t('admin.cancelledBy', { by }), b.cancellationReason ?? '—']);
  }

  await sendEmail({
    to,
    subject: t(`admin.${kind}.subject`, vars),
    template: `staff.booking_${kind}`,
    bookingId: b.id,
    jobId: job.id,
    idempotencyKey: `job/${job.id}`,
    attachments: [logoAttachment],
    react: (
      <StaffEmail
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        address={ADDRESS}
        preview={t(`admin.${kind}.subject`, vars)}
        heading={t(`admin.${kind}.heading`)}
        details={details}
        cta={{ label: t('admin.cta'), href: adminUrl }}
        footer={t('admin.footer')}
      />
    ),
  });
}

/** Staff alert when a background task gives up (e.g. Google Calendar sync failing repeatedly) */
export async function staffTaskFailedEmail(job: Job, error: string) {
  const to = await staffRecipients();
  if (to.length === 0) return;
  const t = await translator(defaultLocale);
  const what = job.type.startsWith('calendar.') ? 'Google Calendar sync' : job.type.startsWith('email.') ? 'Email delivery' : job.type;
  await sendEmail({
    to,
    subject: t('admin.syncError.subject', { what }),
    template: 'staff.task_failed',
    jobId: job.id,
    idempotencyKey: `alert/${job.id}`,
    attachments: [logoAttachment],
    react: (
      <StaffEmail
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        address={ADDRESS}
        preview={t('admin.syncError.subject', { what })}
        heading={t('admin.syncError.heading')}
        intro={t('admin.syncError.intro')}
        details={[
          [t('admin.syncError.task'), `${job.type} (${job.attempts} attempts)`],
          [t('admin.syncError.error'), error.slice(0, 400)],
        ]}
        cta={{ label: t('admin.syncError.cta'), href: `${env.NEXT_PUBLIC_SITE_URL}${routes.admin}` }}
        footer={t('admin.footer')}
      />
    ),
  });
}
