import 'server-only';
import type { Testimonial } from '@/data/testimonials';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * Active testimonials for one page ('home' or a treatment page slug), in admin order.
 * A failed load hides the section instead of breaking the page.
 */
export async function getTestimonials(placement: string): Promise<Testimonial[]> {
  const { data, error } = await createPublicClient()
    .from('testimonials')
    .select('id, quote, body, treatment, tag, rating, image_url, image_alt')
    .contains('placements', [placement])
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('[testimonials] load failed', error.message);
    return [];
  }
  return data.map((t) => ({
    id: t.id,
    quote: t.quote,
    body: t.body,
    treatment: t.treatment,
    tag: t.tag,
    image: t.image_url,
    imageAlt: t.image_alt ?? '',
    rating: t.rating,
  }));
}
