import { Link } from 'react-router-dom';
import SectionLabel from '../ui/SectionLabel';
import { treatmentCategories } from '../../data/treatments';
import { routes } from '../../data/site';

export default function Treatments() {
  return (
    <section id="treatments" className="bg-cream py-20 sm:py-[120px]">
      <div className="container-site">
        <header className="flex flex-col items-start text-left sm:items-center sm:text-center">
          <SectionLabel>Our treatments</SectionLabel>
          <h2 className="heading-lg mt-5 max-w-[640px]">
            Choose where to begin your <em>transformation.</em>
          </h2>
          <p className="mt-4 text-base text-muted sm:text-[17px]">
            Four specialties, one standard: results you can see and feel.
          </p>
        </header>

        <ul className="mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[18px]">
          {treatmentCategories.map((t) => (
            <li key={t.slug}>
              <Link
                to={routes.treatment(t.slug)}
                className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-[14px] p-6 text-cream sm:aspect-[4/5] lg:aspect-auto lg:h-[460px]"
              >
                <img
                  src={t.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 -z-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-ink/5" />
                <div className="relative">
                  <h3 className="text-xl font-medium tracking-[-0.01em] sm:text-[22px]">{t.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/85">
                    {t.description}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex justify-start sm:mt-16 sm:justify-center">
          <Link to={routes.booking} className="btn-dark">
            View the full treatment menu
          </Link>
        </div>
      </div>
    </section>
  );
}
