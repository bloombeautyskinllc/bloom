import { getTranslations } from 'next-intl/server';
import CatalogEditor, { type CatalogCategoryRow } from '@/components/admin/CatalogEditor';
import { PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Catalog' };

export default async function CatalogPage() {
  await requireAdmin('/admin/catalog');
  const t = await getTranslations('bo.catalog');
  const supabase = await createClient();
  const [{ data: categories }, { data: treatments }, { data: options }, { data: settings }] = await Promise.all([
    supabase.from('service_categories').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('treatments').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('treatment_options').select('*').is('deleted_at', null).order('sort_order'),
    supabase.from('business_settings').select('deposit_percent').eq('id', 1).single(),
  ]);

  const rows: CatalogCategoryRow[] = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    color: c.color,
    isActive: c.is_active,
    treatments: (treatments ?? [])
      .filter((x) => x.category_id === c.id)
      .map((x) => ({
        id: x.id,
        categoryId: x.category_id,
        slug: x.slug,
        name: x.name,
        description: x.description,
        includes: x.includes,
        menuGroup: x.menu_group,
        priceCents: x.price_cents,
        priceType: x.price_type,
        durationMinutes: x.duration_minutes,
        bufferBeforeMin: x.buffer_before_min,
        bufferAfterMin: x.buffer_after_min,
        depositPercent: x.deposit_percent,
        isBestSeller: x.is_best_seller,
        isActive: x.is_active,
        needsReview: x.needs_review,
        options: (options ?? [])
          .filter((o) => o.treatment_id === x.id)
          .map((o) => ({
            id: o.id,
            treatmentId: o.treatment_id,
            slug: o.slug,
            groupLabel: o.group_label,
            name: o.name,
            priceCents: o.price_cents,
            priceType: o.price_type,
            extraMinutes: o.extra_duration_minutes,
            isActive: o.is_active,
            needsReview: o.needs_review,
          })),
      })),
  }));

  return (
    <>
      <PageHeader title={t('title')} intro={t('intro')} />
      <CatalogEditor categories={rows} depositPercent={settings?.deposit_percent ?? 40} />
    </>
  );
}
