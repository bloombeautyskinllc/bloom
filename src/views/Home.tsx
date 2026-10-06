import Hero from '../components/home/Hero';
import Treatments from '../components/home/Treatments';
import About from '../components/home/About';
import Approach from '../components/home/Approach';
import Testimonials from '../components/home/Testimonials';
import Faq from '../components/home/Faq';
import type { Testimonial } from '../data/testimonials';

export default function Home({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <>
      <Hero />
      <Treatments />
      <About />
      <Approach />
      <Testimonials testimonials={testimonials} />
      <Faq />
    </>
  );
}
