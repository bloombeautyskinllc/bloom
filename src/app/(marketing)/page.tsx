import Home from '@/views/Home';
import { getTestimonials } from '@/lib/testimonials';

// Testimonials come from the database: saving in admin > Testimonials revalidates this page, this is the fallback
export const revalidate = 300;

export default async function HomePage() {
  return <Home testimonials={await getTestimonials('home')} />;
}
