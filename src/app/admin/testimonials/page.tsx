import { getTranslations } from 'next-intl/server';
import TestimonialsEditor from '@/components/admin/TestimonialsEditor';
import { PageHeader, Panel } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Testimonials' };

export default async function TestimonialsPage() {
  await requireAdmin('/admin/testimonials');
  const t = await getTranslations('bo');
  const { data } = await (await createClient()).from('testimonials').select('*').order('sort_order').order('created_at');

  return (
    <>
      <PageHeader title={t('testimonials.title')} intro={t('testimonials.intro')} />
      <Panel>
        <TestimonialsEditor
          testimonials={(data ?? []).map((x) => ({
            id: x.id,
            quote: x.quote,
            body: x.body,
            treatment: x.treatment,
            tag: x.tag,
            rating: x.rating,
            imageUrl: x.image_url,
            imageAlt: x.image_alt,
            storagePath: x.storage_path,
            placements: x.placements,
            isActive: x.is_active,
          }))}
        />
      </Panel>
    </>
  );
}
