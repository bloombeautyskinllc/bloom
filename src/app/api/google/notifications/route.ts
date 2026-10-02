import { after, NextResponse, type NextRequest } from 'next/server';
import { processJobs } from '@/lib/jobs/runner';
import { createAdminClient } from '@/lib/supabase/admin';

// Google Calendar push notification: "something changed". We verify the channel and token we
// registered, then pull the changes (the notification itself carries no event data).
export async function POST(request: NextRequest) {
  const channelId = request.headers.get('x-goog-channel-id');
  const token = request.headers.get('x-goog-channel-token');
  const state = request.headers.get('x-goog-resource-state');
  if (!channelId || !token) return new NextResponse(null, { status: 400 });

  const admin = createAdminClient();
  const { data: channel } = await admin.from('google_watch_channels').select('id, token, stopped_at').eq('channel_id', channelId).maybeSingle();
  // Unknown or stale channels get a 200 anyway so Google stops retrying; nothing is done for them
  if (!channel || channel.stopped_at || channel.token !== token) return new NextResponse(null, { status: 200 });
  if (state === 'sync') return new NextResponse(null, { status: 200 }); // handshake when the channel is created

  const minute = new Date().toISOString().slice(0, 16);
  await admin
    .from('jobs')
    .upsert([{ type: 'calendar.pull', payload: {}, dedupe_key: `calendar.pull:push:${minute}` }], { onConflict: 'dedupe_key', ignoreDuplicates: true });
  after(() => processJobs({ limit: 5 }).catch((e) => console.error('[jobs] inline run failed', e)));
  return new NextResponse(null, { status: 200 });
}
