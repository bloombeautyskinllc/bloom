import 'server-only';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { logAppEvent } from '@/lib/audit/log';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';

let resend: Resend | undefined;
const client = () => (resend ??= new Resend(serverEnv().RESEND_API_KEY));

export type EmailMessage = {
  to: string | string[];
  subject: string;
  template: string;
  react: ReactElement;
  profileId?: string | null;
  bookingId?: string | null;
  jobId?: string | null;
  /** Same key => Resend sends at most once (24h window), so job retries never duplicate an email */
  idempotencyKey: string;
  /** `contentId` makes it inline: reference it from the HTML as src="cid:<contentId>" */
  attachments?: { filename: string; content: string | Buffer; contentType?: string; contentId?: string }[];
};

/**
 * Sends one transactional email and records it in `notifications` (status + provider id) and the
 * audit log. Throws on failure so the job is retried. Channel-specific: SMS/WhatsApp will get
 * sibling senders behind the same notification record.
 */
export async function sendEmail(message: EmailMessage) {
  const admin = createAdminClient();

  const { data: notification, error: insertError } = await admin
    .from('notifications')
    .insert({
      channel: 'email',
      template: message.template,
      recipient: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      profile_id: message.profileId ?? null,
      booking_id: message.bookingId ?? null,
      job_id: message.jobId ?? null,
      provider: 'resend',
    })
    .select('id')
    .single();
  if (insertError) throw new Error(`notifications insert failed: ${insertError.message}`);

  // Test servers: record the email but never send it (fake test addresses would bounce and hurt the domain)
  if (process.env.EMAIL_DRY_RUN === 'true') {
    await admin
      .from('notifications')
      .update({ status: 'sent', provider: 'dry-run', provider_message_id: `dry-run-${notification.id}`, sent_at: new Date().toISOString() })
      .eq('id', notification.id);
    return { notificationId: notification.id, providerMessageId: `dry-run-${notification.id}` };
  }

  const { data, error } = await client().emails.send(
    {
      from: serverEnv().EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      react: message.react,
      attachments: message.attachments,
      tags: [{ name: 'template', value: message.template.replace(/[^a-zA-Z0-9_-]/g, '_') }],
    },
    { idempotencyKey: message.idempotencyKey },
  );

  if (error || !data) {
    await admin.from('notifications').update({ status: 'failed', error: error?.message ?? 'unknown' }).eq('id', notification.id);
    throw new Error(`Resend: ${error?.name ?? 'error'}: ${error?.message ?? 'no response'}`);
  }

  await admin
    .from('notifications')
    .update({ status: 'sent', provider_message_id: data.id, sent_at: new Date().toISOString() })
    .eq('id', notification.id);

  await logAppEvent({
    action: 'email.sent',
    entityType: 'notification',
    entityId: notification.id,
    metadata: { template: message.template, provider_message_id: data.id, booking_id: message.bookingId ?? null },
  });

  return { notificationId: notification.id, providerMessageId: data.id };
}
