import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { treatmentCategories } from '@/data/treatments';
import { createPublicClient } from '@/lib/supabase/public';
import type { BookingCatalog, CatalogTreatment, IntakeQuestion } from './types';

const questionSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'boolean', 'select']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  help: z.string().optional(),
});

/** Active, bookable catalog (public data, RLS: active rows only). */
export const getBookingCatalog = cache(async (): Promise<BookingCatalog> => {
  const supabase = createPublicClient();
  const [categories, treatments, options, specialists] = await Promise.all([
    supabase.from('service_categories').select('id, slug, name, short_name, description').order('sort_order'),
    supabase
      .from('treatments')
      .select('id, slug, category_id, name, description, includes, menu_group, price_cents, price_type, duration_minutes, is_best_seller, min_options, max_options, intake_form_id, is_bookable')
      .eq('is_bookable', true)
      .order('sort_order'),
    supabase.from('treatment_options').select('id, slug, treatment_id, group_label, name, description, price_cents, price_type, extra_duration_minutes').order('sort_order'),
    supabase.from('specialists').select('id', { count: 'exact', head: true }),
  ]);
  const error = categories.error ?? treatments.error ?? options.error ?? specialists.error;
  if (error) throw new Error(`catalog load failed: ${error.message}`);

  // Intake forms are only readable when signed in; the booking page always is
  const formIds = [...new Set((treatments.data ?? []).map((t) => t.intake_form_id).filter((id): id is string => Boolean(id)))];
  const forms = new Map<string, IntakeQuestion[]>();
  if (formIds.length > 0) {
    const { createClient } = await import('@/lib/supabase/server');
    const { data } = await (await createClient()).from('intake_forms').select('id, questions').in('id', formIds);
    for (const f of data ?? []) forms.set(f.id, z.array(questionSchema).catch([]).parse(f.questions));
  }

  const siteImages = new Map(treatmentCategories.map((c) => [c.slug, c.menuImage]));
  const categorySlug = new Map((categories.data ?? []).map((c) => [c.id, c.slug]));

  const byCategory = new Map<string, CatalogTreatment[]>();
  for (const t of treatments.data ?? []) {
    const slug = categorySlug.get(t.category_id);
    if (!slug || t.duration_minutes === null) continue;
    const treatmentOptions = (options.data ?? [])
      .filter((o) => o.treatment_id === t.id && o.extra_duration_minutes !== null)
      .map((o) => ({
        id: o.id,
        slug: o.slug,
        groupLabel: o.group_label,
        name: o.name,
        description: o.description,
        priceCents: o.price_cents,
        priceType: o.price_type,
        extraMinutes: o.extra_duration_minutes ?? 0,
      }));
    const list = byCategory.get(slug) ?? [];
    list.push({
      id: t.id,
      slug: t.slug,
      categorySlug: slug,
      name: t.name,
      description: t.description,
      includes: t.includes,
      menuGroup: t.menu_group,
      priceCents: t.price_cents,
      priceType: t.price_type,
      durationMinutes: t.duration_minutes,
      isBestSeller: t.is_best_seller,
      minOptions: t.min_options,
      maxOptions: t.max_options,
      intake: t.intake_form_id ? { formId: t.intake_form_id, questions: forms.get(t.intake_form_id) ?? [] } : null,
      options: treatmentOptions,
    });
    byCategory.set(slug, list);
  }

  return {
    categories: (categories.data ?? [])
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        shortName: c.short_name ?? c.name,
        description: c.description,
        image: siteImages.get(c.slug) ?? null,
        treatments: byCategory.get(c.slug) ?? [],
      }))
      .filter((c) => c.treatments.length > 0),
    specialistCount: specialists.count ?? 1,
  };
});
