// Minimal Google Calendar v3 REST client (events + push channels)

const API = 'https://www.googleapis.com/calendar/v3';

export type GoogleEventTime = { dateTime?: string; date?: string; timeZone?: string };

export type GoogleEvent = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  transparency?: 'opaque' | 'transparent';
  extendedProperties?: { private?: Record<string, string> };
};

export type GoogleEventInput = Omit<GoogleEvent, 'id' | 'status'> & { reminders?: { useDefault: boolean }; colorId?: string };

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class CalendarClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (json as { error?: { message?: string } }).error?.message ?? res.statusText;
      throw new GoogleApiError(`Google Calendar ${method} ${path.split('?')[0]}: ${res.status} ${message}`, res.status);
    }
    return json as T;
  }

  private static cal(calendarId: string) {
    return `/calendars/${encodeURIComponent(calendarId)}`;
  }

  insertEvent(calendarId: string, event: GoogleEventInput) {
    return this.request<GoogleEvent>('POST', `${CalendarClient.cal(calendarId)}/events`, event);
  }

  patchEvent(calendarId: string, eventId: string, event: Partial<GoogleEventInput>) {
    return this.request<GoogleEvent>('PATCH', `${CalendarClient.cal(calendarId)}/events/${encodeURIComponent(eventId)}`, event);
  }

  /** Deleting an event that is already gone (404/410) counts as success */
  async deleteEvent(calendarId: string, eventId: string) {
    try {
      await this.request<void>('DELETE', `${CalendarClient.cal(calendarId)}/events/${encodeURIComponent(eventId)}`);
    } catch (e) {
      if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return;
      throw e;
    }
  }

  /**
   * One page of changes. First call: pass timeMin; next calls: pass the syncToken from the last page.
   * A 410 means the sync token expired and a full sync is needed.
   */
  listEvents(calendarId: string, params: { syncToken?: string; timeMin?: string; pageToken?: string }) {
    const q = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
    if (params.syncToken) q.set('syncToken', params.syncToken);
    else if (params.timeMin) q.set('timeMin', params.timeMin);
    if (params.pageToken) q.set('pageToken', params.pageToken);
    return this.request<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>('GET', `${CalendarClient.cal(calendarId)}/events?${q.toString()}`);
  }

  watchEvents(calendarId: string, channel: { id: string; address: string; token: string; ttlSeconds: number }) {
    return this.request<{ resourceId: string; expiration?: string }>('POST', `${CalendarClient.cal(calendarId)}/events/watch`, {
      id: channel.id,
      type: 'web_hook',
      address: channel.address,
      token: channel.token,
      params: { ttl: String(channel.ttlSeconds) },
    });
  }

  async stopChannel(channelId: string, resourceId: string) {
    try {
      await this.request<void>('POST', '/channels/stop', { id: channelId, resourceId });
    } catch (e) {
      if (e instanceof GoogleApiError && e.status === 404) return;
      throw e;
    }
  }
}
