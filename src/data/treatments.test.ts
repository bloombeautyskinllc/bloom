import { describe, expect, it } from 'vitest';
import { findTreatmentPage } from './treatmentPages';
import { treatmentCategories } from './treatments';

// The header decides on a transparent bar from the category list alone, so it never ships the page data
describe('treatment pages', () => {
  it.each(treatmentCategories.map((c) => c.slug))('category %s has a full treatment page', (slug) => {
    expect(findTreatmentPage(slug)).toBeDefined();
  });
});
