import { z } from 'zod';
import { routes } from '@/data/site';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';

/** Bookings whose form can be signed through a link (matches staff_consent_link) */
export const CONSENT_LINK_STATUSES: Database['public']['Enums']['booking_status'][] = ['pending_payment', 'confirmed', 'completed'];

/** Token of a consent form link (see supabase/migrations/*_consent_links.sql) */
export const consentTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

export const consentLinkUrl = (token: string) => new URL(routes.consentLink(token), env.NEXT_PUBLIC_SITE_URL).toString();
