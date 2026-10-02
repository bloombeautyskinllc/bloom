import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { bookingEmail, reminderEmail, reviewRequestEmail, staffBookingEmail, staffTaskFailedEmail } from './handlers/booking-emails';
import { calendarPull, calendarRenewWatch, calendarSync } from './handlers/calendar';
import { welcomeEmail } from './handlers/welcome-email';
import type { JobHandler } from './types';

// job.type -> handler. Handlers must be idempotent: a job can run more than once.
const handlers: Record<string, JobHandler> = {
  'email.welcome': welcomeEmail,
  'email.booking': bookingEmail,
  'email.admin_booking': staffBookingEmail,
  'email.reminder': reminderEmail,
  'email.review_request': reviewRequestEmail,
  'calendar.sync': calendarSync,
  'calendar.pull': calendarPull,
  'calendar.renew_watch': calendarRenewWatch,
};

export type JobResult = { id: string; type: string; ok: boolean; error?: string };

/**
 * Claims due jobs (FOR UPDATE SKIP LOCKED, so concurrent workers never share one), runs them and
 * records the outcome. Failures are retried by the database with exponential backoff; when a job
 * runs out of attempts, staff get an email.
 */
export async function processJobs({ limit = 10 }: { limit?: number } = {}): Promise<JobResult[]> {
  const admin = createAdminClient();
  const worker = `web-${crypto.randomUUID().slice(0, 8)}`;

  const { data: jobs, error } = await admin.rpc('claim_jobs', { p_worker: worker, p_limit: limit });
  if (error) throw new Error(`claim_jobs failed: ${error.message}`);

  const results: JobResult[] = [];
  for (const job of jobs ?? []) {
    try {
      const handler = handlers[job.type];
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      await handler(job);
      const { error: doneError } = await admin.rpc('complete_job', { p_job_id: job.id });
      if (doneError) throw new Error(`complete_job failed: ${doneError.message}`);
      results.push({ id: job.id, type: job.type, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[jobs] ${job.type} ${job.id} failed (attempt ${job.attempts}/${job.max_attempts}):`, message);
      await admin.rpc('fail_job', { p_job_id: job.id, p_error: message });
      if (job.attempts >= job.max_attempts && !job.type.startsWith('email.')) {
        // Email failures are not reported by email (it would likely fail too); they show in the back office
        await staffTaskFailedEmail(job, message).catch((alertError) => console.error('[jobs] staff alert failed', alertError));
      }
      results.push({ id: job.id, type: job.type, ok: false, error: message });
    }
  }
  return results;
}
