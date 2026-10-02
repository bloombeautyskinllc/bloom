import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/** "+12125550100" -> "+1 212 555 0100"; anything unparseable is returned as-is */
export function formatPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
