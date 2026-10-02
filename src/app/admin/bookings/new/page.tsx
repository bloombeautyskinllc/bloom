import { getTranslations } from 'next-intl/server';
import NewBookingForm, { type FormTreatment } from '@/components/admin/NewBookingForm';
import { PageHeader } from '@/components/admin/ui';
import { addDays, localDate } from '@/lib/availability/timezone';
import { requireStaff } from '@/lib/auth/session';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'New booking' };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireStaff('/admin/bookings/new');
  const [t, settings, { client }] = await Promise.all([getTranslations('bo.newBooking'), getPublicSettings(), searchParams]);
  const supabase = await createClient();

  const [{ data: treatments }, { data: options }, { data: categories }, { data: specialists }, { data: preselected }] = await Promise.all([
    supabase.from('treatments').select('id, name, category_id, price_cents, duration_minutes, sort_order').is('deleted_at', null).not('duration_minutes', 'is', null).order('sort_order'),
    supabase.from('treatment_options').select('id, treatment_id, name, group_label, price_cents, extra_duration_minutes, sort_order').is('deleted_at', null).order('sort_order'),
    supabase.from('service_categories').select('id, name, sort_order').is('deleted_at', null).order('sort_order'),
    supabase.from('specialists').select('id, display_name').eq('is_active', true).is('deleted_at', null).order('sort_order'),
    client ? supabase.from('client_overview').select('id, full_name, email, phone_e164, visits').eq('id', client).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const categoryOrder = new Map((categories ?? []).map((c) => [c.id, c.sort_order]));
  const formTreatments: FormTreatment[] = (treatments ?? [])
    .sort((a, b) => (categoryOrder.get(a.category_id) ?? 0) - (categoryOrder.get(b.category_id) ?? 0) || a.sort_order - b.sort_order)
    .map((x) => ({
      id: x.id,
      name: x.name,
      category: categoryName.get(x.category_id) ?? '',
      priceCents: x.price_cents,
      durationMinutes: x.duration_minutes ?? 0,
      options: (options ?? [])
        .filter((o) => o.treatment_id === x.id)
        .map((o) => ({ id: o.id, name: o.name, group: o.group_label, priceCents: o.price_cents, extraMinutes: o.extra_duration_minutes ?? 0 })),
    }));

  return (
    <>
      <PageHeader title={t('title')} intro={t('intro')} />
      <NewBookingForm
        treatments={formTreatments}
        specialists={(specialists ?? []).map((s) => ({ id: s.id, name: s.display_name }))}
        timeZone={settings.timezone}
        defaultDate={addDays(localDate(Date.now(), settings.timezone), 1)}
        preselectedClient={preselected ? { id: preselected.id!, name: preselected.full_name, email: preselected.email, phone: preselected.phone_e164, visits: preselected.visits ?? 0 } : null}
      />
    </>
  );
}
