import Hero from '../components/home/Hero';
import Treatments from '../components/home/Treatments';
import About from '../components/home/About';
import Approach from '../components/home/Approach';
import Testimonials from '../components/home/Testimonials';
import Faq from '../components/home/Faq';

export default function Home() {
  return (
    <>
      <Hero />
      <Treatments />
      <About />
      <Approach />
      <Testimonials />
      <Faq />
    </>
  );
}
