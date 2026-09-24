import { Link } from 'react-router-dom';
import SectionLabel from '../components/ui/SectionLabel';
import Flower from '../components/ui/Flower';
import Reveal from '../components/motion/Reveal';
import SplitText from '../components/motion/SplitText';
import GlowOrb from '../components/decor/GlowOrb';
import Sparkles from '../components/decor/Sparkles';
import { routes, site } from '../data/site';

// Temporary page for routes that will be built next (booking, legal pages, intake form).
export default function ComingSoon({ title }: { title: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-cream to-stone pb-24 pt-44 sm:pt-52">
      <GlowOrb className="-left-40 top-10 h-[560px] w-[560px]" />
      <GlowOrb className="-right-40 bottom-[-20%] h-[520px] w-[520px]" color="rgba(205, 194, 180, 0.6)" delay={-7} />
      {/* Oversized petal turning slowly behind the message */}
      <Flower className="absolute left-[calc(50%-260px)] top-24 -z-10 h-[520px] w-[520px] opacity-50" />
      <Sparkles
        className="text-accent/60"
        items={[
          { top: '30%', left: '18%', size: 14, delay: 0.2 },
          { top: '62%', left: '12%', size: 9, delay: 1.9 },
          { top: '26%', left: '80%', size: 10, delay: 1.1 },
          { top: '70%', left: '86%', size: 16, delay: 2.8 },
        ]}
      />

      <div className="container-site flex flex-col items-center text-center">
        <SectionLabel lines="both" delay={200}>
          Coming soon
        </SectionLabel>
        <SplitText as="h1" delay={350} className="heading-lg mt-5 max-w-[640px]">
          {title}
        </SplitText>
        <Reveal as="p" variant="blur" delay={750} className="mt-5 max-w-[440px] text-muted">
          This page is on its way. In the meantime, message us on WhatsApp and a specialist will help you right away.
        </Reveal>
        <Reveal delay={950} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={site.whatsappUrl} target="_blank" rel="noreferrer" className="btn-dark">
            Message us on WhatsApp
          </a>
          <Link to={routes.home} className="btn border border-bronze/40 text-ink [--sheen:rgba(131,104,85,0.2)] hover:bg-white/50">
            Back to home
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
