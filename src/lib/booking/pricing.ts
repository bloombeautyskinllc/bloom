import type { CatalogTreatment, Quote } from './types';

/**
 * Live estimate for the booking summary. Mirrors public.hold_slot, which recomputes the real
 * price and duration server-side: never send these numbers to the server.
 */
export function quote(treatment: CatalogTreatment, selectedOptionIds: readonly string[]): Quote {
  const selected = treatment.options.filter((o) => selectedOptionIds.includes(o.id));
  const count = selected.length;
  return {
    totalCents: treatment.priceCents + selected.reduce((sum, o) => sum + o.priceCents, 0),
    durationMinutes: treatment.durationMinutes + selected.reduce((sum, o) => sum + o.extraMinutes, 0),
    priceType: treatment.priceType === 'from' || selected.some((o) => o.priceType === 'from') ? 'from' : 'fixed',
    optionsValid: count >= treatment.minOptions && (treatment.maxOptions === null || count <= treatment.maxOptions),
  };
}
