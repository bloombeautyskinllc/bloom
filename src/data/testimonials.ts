import { treatmentCategories } from './treatments';

/** A client story as the site renders it; rows live in the `testimonials` table (admin > Testimonials) */
export type Testimonial = {
  id: string;
  quote: string;
  body: string;
  treatment: string | null;
  tag: string | null;
  image: string;
  imageAlt: string;
  rating: number;
};

/** Pages a testimonial can appear on: the home page or a treatment page (by slug) */
export const testimonialPlacements = [
  { id: 'home', label: 'Home' },
  ...treatmentCategories.map((c) => ({ id: c.slug, label: c.title })),
];
