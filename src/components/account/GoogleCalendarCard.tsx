import { getTranslations } from 'next-intl/server';
import { disconnectGoogleCalendar } from '@/lib/google/actions';
import Card from './Card';
import GoogleIcon from './GoogleIcon';

type Props = {
  kind: 'client' | 'business';
  connection: { googleEmail: string | null; lastError: string | null } | null;
  status?: string; // ?calendar=... after the OAuth round trip
};

const STATUSES = ['connected', 'disconnected', 'cancelled', 'missing_permission', 'error'] as const;

export default async function GoogleCalendarCard({ kind, connection, status }: Props) {
  const t = await getTranslations(`calendar.${kind}`);
  const ts = await getTranslations('calendar.status');
  const notice = STATUSES.find((s) => s === status);
  const next = kind === 'business' ? '/admin/settings' : '/dashboard';

  return (
    <Card>
      <div className="flex items-center gap-3">
        <GoogleIcon className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-ink">{t('title')}</h2>
      </div>
      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-sand px-4 py-2.5 text-sm text-ink">
          {ts(notice)}
        </p>
      )}
      {connection ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t('connected', { email: connection.googleEmail ?? '' })}</p>
          {kind === 'business' && connection.lastError && (
            <p className="mt-2 text-sm text-red-800">{t('lastError', { error: connection.lastError.slice(0, 160) })}</p>
          )}
          <form action={disconnectGoogleCalendar} className="mt-4">
            <input type="hidden" name="kind" value={kind} />
            <button type="submit" className="text-sm text-bronze underline decoration-taupe underline-offset-4 hover:text-ink">
              {t('disconnect')}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t('body')}</p>
          {kind === 'client' && <p className="mt-2 text-xs text-muted">{t('without')}</p>}
          {/* Plain link: the OAuth flow is a full-page redirect to Google */}
          <a
            href={`/api/google/connect?kind=${kind}&next=${encodeURIComponent(next)}`}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-taupe bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-bronze"
          >
            <GoogleIcon className="h-4 w-4" />
            {t('connect')}
          </a>
        </>
      )}
    </Card>
  );
}
