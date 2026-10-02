'use client';

import { useMemo } from 'react';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/min';

/** Phone country codes: US first, then alphabetical by country name. Client-only (rendered after interaction). */
export function useCountryOptions() {
  return useMemo(() => {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return getCountries()
      .map((code) => ({ code, name: names.of(code) ?? code, label: `${code} +${getCountryCallingCode(code)}` }))
      .sort((a, b) => (a.code === 'US' ? -1 : b.code === 'US' ? 1 : a.name.localeCompare(b.name)));
  }, []);
}
