import { Link } from 'react-router-dom';
import SectionLabel from '../components/ui/SectionLabel';
import { routes, site } from '../data/site';

// Temporary page for routes that will be built next (booking, legal pages, intake form).
export default function ComingSoon({ title }: { title: string }) {
  return (
    <section className="bg-gradient-to-b from-cream to-stone pb-24 pt-44 sm:pt-52">
      <div className="container-site flex flex-col items-center text-center">
        <SectionLabel>Coming soon</SectionLabel>
        <h1 className="heading-lg mt-5 max-w-[640px]">{title}</h1>
        <p className="mt-5 max-w-[440px] text-muted">
          This page is on its way. In the meantime, message us on WhatsApp and a specialist will help you right away.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={site.whatsappUrl} target="_blank" rel="noreferrer" className="btn-dark">
            Message us on WhatsApp
          </a>
          <Link to={routes.home} className="btn border border-bronze/40 text-ink hover:bg-white/50">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
