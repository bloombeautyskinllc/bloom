import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TreatmentPage from '@/views/TreatmentPage';
import { treatmentCategories } from '@/data/treatments';
import { getTreatmentMenu } from '@/lib/catalog/menu';

// The menu comes from the catalog: saving in admin > Catalog revalidates these pages, this is the fallback
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return treatmentCategories.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = treatmentCategories.find((c) => c.slug === slug);
  return category ? { title: `${category.title} | BLOOM Beauty Skin`, description: category.description } : {};
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!treatmentCategories.some((c) => c.slug === slug)) notFound();
  return <TreatmentPage slug={slug} menu={await getTreatmentMenu(slug)} />;
}
