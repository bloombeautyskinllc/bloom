// Serializable catalog shapes passed from Server Components to the booking flow

export type PriceType = 'fixed' | 'from';

export type CatalogOption = {
  id: string;
  slug: string;
  groupLabel: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  priceType: PriceType;
  extraMinutes: number;
};

export type IntakeQuestion = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'boolean' | 'select';
  options?: string[];
  required?: boolean;
  help?: string;
};

export type CatalogTreatment = {
  id: string;
  slug: string;
  categorySlug: string;
  name: string;
  description: string | null;
  includes: string[];
  menuGroup: string | null;
  priceCents: number;
  priceType: PriceType;
  durationMinutes: number;
  isBestSeller: boolean;
  minOptions: number;
  maxOptions: number | null;
  intake: { formId: string; questions: IntakeQuestion[] } | null;
  options: CatalogOption[];
};

export type CatalogCategory = {
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  image: string | null;
  treatments: CatalogTreatment[];
};

export type BookingCatalog = {
  categories: CatalogCategory[];
  specialistCount: number;
};

export type Quote = { totalCents: number; durationMinutes: number; priceType: PriceType; optionsValid: boolean };
