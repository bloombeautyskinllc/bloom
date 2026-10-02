// In production pg_cron calls /api/jobs/run every minute (see configure_job_worker). A hosted
// database cannot reach a dev server on this machine, so `next dev` polls the worker itself:
// booking emails and Google Calendar sync then run locally too.
const POLL_MS = 30_000;

export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'development') return;
  const g = globalThis as { __bloomJobPoller?: ReturnType<typeof setInterval> };
  if (g.__bloomJobPoller) return; // register can run again after a hot reload

  const { NEXT_PUBLIC_SITE_URL: siteUrl, JOBS_SECRET: secret } = process.env;
  if (!siteUrl || !secret) return;

  g.__bloomJobPoller = setInterval(async () => {
    try {
      const res = await fetch(`${siteUrl.replace(/\/$/, '')}/api/jobs/run`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
      const body = (await res.json().catch(() => null)) as { processed?: number; failed?: number } | null;
      if (!res.ok) console.error(`[jobs] dev poller: HTTP ${res.status}`);
      else if (body?.processed) console.log(`[jobs] dev poller: ${body.processed} processed, ${body.failed ?? 0} failed`);
    } catch (e) {
      console.error('[jobs] dev poller:', e instanceof Error ? e.message : e);
    }
  }, POLL_MS);
}
