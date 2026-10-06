import 'server-only';
import { cache } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { site } from '@/data/site';
import { getPublicSettings } from '@/lib/settings';

/** Business contact details as the site shows them; edited in admin > Settings */
export type Contact = {
  phone: string | null;
  phoneHref: string | null;
  whatsappUrl: string;
  email: string | null;
  address: { line1: string; line2: string | null; mapsUrl: string } | null;
};

/** Used when the settings cannot be loaded, so the site never shows empty contact links */
const fallback: Contact = {
  phone: site.phone,
  phoneHref: site.phoneHref,
  whatsappUrl: site.whatsappUrl,
  email: site.email,
  address: site.address,
};

// "+13474833337" → "+1 (347) 483-3337"; other countries in international format
function formatPhone(e164: string) {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === 'US' ? `+1 ${parsed.formatNational()}` : parsed.formatInternational();
}

/** Contact details from business_settings. WhatsApp falls back to the phone number, then to the site default. */
export const getContact = cache(async (): Promise<Contact> => {
  try {
    const s = await getPublicSettings();
    const whatsapp = s.whatsapp_e164 ?? s.phone_e164;
    const line1 = s.address_line1?.trim();
    const line2 = s.address_line2?.trim() || null;
    return {
      phone: s.phone_e164 ? formatPhone(s.phone_e164) : null,
      phoneHref: s.phone_e164 ? `tel:${s.phone_e164}` : null,
      whatsappUrl: whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : fallback.whatsappUrl,
      email: s.public_email,
      address: line1
        ? { line1, line2, mapsUrl: `https://maps.google.com/?q=${encodeURIComponent([line1, line2].filter(Boolean).join(', '))}` }
        : null,
    };
  } catch (e) {
    console.error('[contact] settings load failed, using defaults', e);
    return fallback;
  }
});

/** One-line address for emails and calendar events */
export const addressLine = (c: Contact) => (c.address ? [c.address.line1, c.address.line2].filter(Boolean).join(', ') : '');
