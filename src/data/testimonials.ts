import storyBrows from '../assets/images/story-brows.webp';
import storyMicroneedling from '../assets/images/story-microneedling.webp';

export type Testimonial = {
  tag: string;
  quote: string;
  body: string;
  treatment: string;
  image: string;
  rating: number;
};

export const testimonials: Testimonial[] = [
  {
    tag: 'Brow design',
    quote: 'My brows finally look balanced and natural.',
    body: 'They took the time to understand my face before designing anything. My shadow brows look soft, not drawn on, and I wake up feeling ready.',
    treatment: 'Shadow Brows',
    image: storyBrows,
    rating: 5,
  },
  {
    tag: 'Microneedling',
    quote: 'My skin texture changed more than I thought possible.',
    body: 'After my series of sessions my pores look refined and my old acne marks are much softer. Every step was explained, and the aftercare plan made all the difference.',
    treatment: 'Microneedling',
    image: storyMicroneedling,
    rating: 5,
  },
];
