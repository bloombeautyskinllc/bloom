import 'server-only';
import { z } from 'zod';
import { routes, site } from '@/data/site';
import { logAppEvent } from '@/lib/audit/log';
import { loadBooking, type BookingDetails } from '@/lib/booking/load';
import { env } from '@/lib/env';
import { businessEvent, clientEvent, type BookingForCalendar } from '@/lib/google/booking-event';
import { GoogleApiError } from '@/lib/google/calendar';
import { connectedCalendar, type ConnectedCalendar, type OwnerKind } from '@/lib/google/credentials';
import { mirrorAction } from '@/lib/google/sync-mirror';
import { getPublicSettings } from '@/lib/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Job } from '../types';

function forCalendar(b: BookingDetails): BookingForCalendar {
  return {
    id: b.id,
    code: b.code,
    startAt: b.startAt,
    endAt: b.endAt,
    status: b.status,
    paymentStatus: b.paymentStatus,
    totalCents: b.totalCents,
    isStartingPrice: b.isStartingPrice,
    treatmentName: b.treatmentName,
    optionNames: b.optionNames,
    clientNotes: b.clientNotes,
    client: { name: b.client.name, email: b.client.email, phone: b.client.phone },
  };
}

// -----------------------------------------------------------------------------
// calendar.sync: create / update / delete the booking's events
// -----------------------------------------------------------------------------
const syncPayload = z.object({ booking_id: z.uuid() });

export async function calendarSync(job: Job) {
  const { booking_id } = syncPayload.parse(job.payload);
  const booking = await loadBooking(booking_id);
  if (!booking) return;

  const admin = createAdminClient();
  const { timezone } = await getPublicSettings();
  const { data: existing } = await admin.from('calendar_events').select('*').eq('booking_id', booking_id);
  const errors: string[] = [];

  const targets: { kind: OwnerKind; calendar: ConnectedCalendar | null }[] = [
    { kind: 'business', calendar: await connectedCalendar('business') },
    // Deleted accounts never get calendar events
    { kind: 'client', calendar: booking.client.gone ? null : await connectedCalendar('client', booking.client.id) },
  ];

  for (const { kind, calendar } of targets) {
    if (!calendar) continue; // not connected: the client gets .ics emails instead
    const row = existing?.find((e) => e.kind === kind);
    const shouldExist = booking.status === 'confirmed';
    const sameCredential = row?.credential_id === calendar.credentialId && row.google_event_id;

    try {
      if (shouldExist) {
        const body =
          kind === 'business'
            ? businessEvent(forCalendar(booking), { adminUrl: `${env.NEXT_PUBLIC_SITE_URL}${routes.admin}?booking=${booking.code}`, timeZone: timezone })
            : clientEvent(forCalendar(booking), { manageUrl: `${env.NEXT_PUBLIC_SITE_URL}${routes.dashboard}`, location: `${site.address.line1}, ${site.address.line2}`, timeZone: timezone });

        let eventId = sameCredential ? row!.google_event_id! : null;
        if (eventId) {
          try {
            await calendar.client.patchEvent(calendar.calendarId, eventId, body);
          } catch (e) {
            // Deleted by hand in Google: create it again
            if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) eventId = null;
            else throw e;
          }
        }
        if (!eventId) eventId = (await calendar.client.insertEvent(calendar.calendarId, body)).id;

        await admin.from('calendar_events').upsert(
          { booking_id, kind, credential_id: calendar.credentialId, calendar_id: calendar.calendarId, google_event_id: eventId, sync_status: 'synced', last_synced_at: new Date().toISOString(), last_error: null },
          { onConflict: 'booking_id,kind' },
        );
      } else if (sameCredential) {
        await calendar.client.deleteEvent(calendar.calendarId, row!.google_event_id!);
        await admin.from('calendar_events').update({ sync_status: 'deleted', last_synced_at: new Date().toISOString(), last_error: null }).eq('id', row!.id);
      }
      await admin.rpc('mark_google_credential', { p_credential_id: calendar.credentialId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${kind}: ${message}`);
      await admin.from('calendar_events').upsert(
        { booking_id, kind, credential_id: calendar.credentialId, calendar_id: calendar.calendarId, google_event_id: row?.google_event_id ?? null, sync_status: 'error', last_error: message.slice(0, 1000) },
        { onConflict: 'booking_id,kind' },
      );
      await admin.rpc('mark_google_credential', { p_credential_id: calendar.credentialId, p_error: message.slice(0, 500) });
    }
  }

  await logAppEvent({
    action: errors.length ? 'calendar.sync_failed' : 'calendar.synced',
    entityType: 'booking',
    entityId: booking_id,
    metadata: { status: booking.status, errors },
  });
  if (errors.length) throw new Error(errors.join(' | ')); // retried with backoff
}

// -----------------------------------------------------------------------------
// calendar.pull: two-way sync, Google -> availability blocks (incremental with syncToken)
// -----------------------------------------------------------------------------
export async function calendarPull() {
  const calendar = await connectedCalendar('business');
  if (!calendar) return;

  const admin = createAdminClient();
  const { timezone } = await getPublicSettings();
  const { data: state } = await admin.from('google_sync_state').select('sync_token').eq('credential_id', calendar.credentialId).maybeSingle();

  let syncToken = state?.sync_token ?? undefined;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let upserts = 0;
  let removals = 0;

  for (let page = 0; page < 40; page++) {
    let result;
    try {
      result = await calendar.client.listEvents(calendar.calendarId, { syncToken, pageToken, timeMin: new Date(Date.now() - 86_400_000).toISOString() });
    } catch (e) {
      // Expired sync token: start over with a full sync
      if (e instanceof GoogleApiError && e.status === 410 && syncToken) {
        syncToken = undefined;
        pageToken = undefined;
        continue;
      }
      throw e;
    }

    for (const event of result.items ?? []) {
      const action = mirrorAction(event, timezone);
      if (action.kind === 'upsert') {
        const { error } = await admin.from('availability_blocks').upsert(
          // No event title: the owner's personal calendar details stay out of our database
          { google_event_id: action.googleEventId, range: `[${action.start},${action.end})`, source: 'google', reason: 'Busy in Google Calendar', specialist_id: null, deleted_at: null },
          { onConflict: 'google_event_id' },
        );
        if (error) throw new Error(`block upsert failed: ${error.message}`);
        upserts++;
      } else if (action.kind === 'remove') {
        await admin.from('availability_blocks').update({ deleted_at: new Date().toISOString() }).eq('google_event_id', action.googleEventId).is('deleted_at', null);
        removals++;
      }
    }

    pageToken = result.nextPageToken;
    nextSyncToken = result.nextSyncToken ?? nextSyncToken;
    if (!pageToken) break;
  }

  await admin
    .from('google_sync_state')
    .upsert({ credential_id: calendar.credentialId, sync_token: nextSyncToken ?? syncToken ?? null, last_pull_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await admin.rpc('mark_google_credential', { p_credential_id: calendar.credentialId });
  if (upserts || removals) {
    await logAppEvent({ action: 'calendar.pulled', entityType: 'google_calendar', entityId: calendar.credentialId, metadata: { blocked: upserts, freed: removals } });
  }
}

// -----------------------------------------------------------------------------
// calendar.renew_watch: keep a push channel open (needs a public HTTPS URL)
// -----------------------------------------------------------------------------
const CHANNEL_TTL_SECONDS = 7 * 24 * 3600;

export async function calendarRenewWatch() {
  const address = `${env.NEXT_PUBLIC_SITE_URL}/api/google/notifications`;
  if (!address.startsWith('https://')) return; // Google only pushes to HTTPS; the 15-minute pull covers local/dev
  const calendar = await connectedCalendar('business');
  if (!calendar) return;

  const admin = createAdminClient();
  const { data: channels } = await admin
    .from('google_watch_channels')
    .select('*')
    .eq('credential_id', calendar.credentialId)
    .is('stopped_at', null);
  const healthy = (channels ?? []).some((c) => c.expires_at && Date.parse(c.expires_at) > Date.now() + 24 * 3600_000);
  if (healthy) return;

  const channelId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const created = await calendar.client.watchEvents(calendar.calendarId, { id: channelId, address, token, ttlSeconds: CHANNEL_TTL_SECONDS });
  await admin.from('google_watch_channels').insert({
    credential_id: calendar.credentialId,
    calendar_id: calendar.calendarId,
    channel_id: channelId,
    resource_id: created.resourceId,
    token,
    expires_at: created.expiration ? new Date(Number(created.expiration)).toISOString() : null,
  });

  // Retire the old channels
  for (const old of channels ?? []) {
    if (old.resource_id) await calendar.client.stopChannel(old.channel_id, old.resource_id).catch(() => undefined);
    await admin.from('google_watch_channels').update({ stopped_at: new Date().toISOString() }).eq('id', old.id);
  }
  await logAppEvent({ action: 'calendar.watch_renewed', entityType: 'google_calendar', entityId: calendar.credentialId, metadata: { channelId } });
}
