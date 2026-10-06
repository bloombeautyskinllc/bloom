'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type CatalogResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'duplicate' | 'generic' };

async function requireAdminSession() {
  const session = await getSession();
  return session?.profile.role === 'admin' ? session : null;
}

// The public site reads the catalog too: refresh everything that shows it
function refreshCatalog() {
  for (const path of ['/admin/catalog', '/booking', '/admin/bookings/new']) revalidatePath(path);
  revalidatePath('/(marketing)/treatments/[slug]', 'page');
}

const money = z.number().int().min(0).max(10_000_000);
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);

const treatmentSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid(),
  slug,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  includes: z.array(z.string().trim().min(1).max(160)).max(20),
  menuGroup: z.string().trim().max(60).optional(),
  priceCents: money,
  priceType: z.enum(['fixed', 'from']),
  durationMinutes: z.number().int().min(5).max(600).nullable(),
  bufferBeforeMin: z.number().int().min(0).max(240),
  bufferAfterMin: z.number().int().min(0).max(240),
  depositPercent: z.number().int().min(0).max(100).nullable(),
  // 0 = choosing an option is optional; null max = no limit
  minOptions: z.number().int().min(0).max(50),
  maxOptions: z.number().int().min(1).max(50).nullable(),
  isBestSeller: z.boolean(),
  isActive: z.boolean(),
  needsReview: z.boolean(),
}).refine((v) => v.maxOptions === null || v.maxOptions >= v.minOptions);

export async function saveTreatment(input: z.input<typeof treatmentSchema>): Promise<CatalogResult> {
  if (!(await requireAdminSession())) return { ok: false, error: 'forbidden' };
  const parsed = treatmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v = parsed.data;
  const row = {
    category_id: v.categoryId,
    slug: v.slug,
    name: v.name,
    description: v.description || null,
    includes: v.includes,
    menu_group: v.menuGroup || null,
    price_cents: v.priceCents,
    price_type: v.priceType,
    duration_minutes: v.durationMinutes,
    buffer_before_min: v.bufferBeforeMin,
    buffer_after_min: v.bufferAfterMin,
    deposit_percent: v.depositPercent,
    min_options: v.minOptions,
    max_options: v.maxOptions,
    is_best_seller: v.isBestSeller,
    is_active: v.isActive,
    needs_review: v.needsReview,
  };
  const supabase = await createClient();
  const { error } = v.id ? await supabase.from('treatments').update(row).eq('id', v.id) : await supabase.from('treatments').insert(row);
  if (error) return { ok: false, error: error.code === '23505' ? 'duplicate' : 'generic' };

  // A new treatment is performed by every active specialist until the team page says otherwise
  if (!v.id) {
    const { data: created } = await supabase.from('treatments').select('id').eq('slug', v.slug).single();
    const { data: specialists } = await supabase.from('specialists').select('id').eq('is_active', true).is('deleted_at', null);
    if (created && specialists?.length) {
      await supabase.from('specialist_treatments').upsert(specialists.map((s) => ({ specialist_id: s.id, treatment_id: created.id })), { ignoreDuplicates: true });
    }
  }
  refreshCatalog();
  return { ok: true };
}

const optionSchema = z.object({
  id: z.uuid().optional(),
  treatmentId: z.uuid(),
  slug,
  groupLabel: z.string().trim().max(60).optional(),
  name: z.string().trim().min(1).max(120),
  priceCents: money,
  priceType: z.enum(['fixed', 'from']),
  extraMinutes: z.number().int().min(0).max(600).nullable(),
  isActive: z.boolean(),
  needsReview: z.boolean(),
});

export async function saveOption(input: z.input<typeof optionSchema>): Promise<CatalogResult> {
  if (!(await requireAdminSession())) return { ok: false, error: 'forbidden' };
  const parsed = optionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v = parsed.data;
  const row = {
    treatment_id: v.treatmentId,
    slug: v.slug,
    group_label: v.groupLabel || null,
    name: v.name,
    price_cents: v.priceCents,
    price_type: v.priceType,
    extra_duration_minutes: v.extraMinutes,
    is_active: v.isActive,
    needs_review: v.needsReview,
  };
  const supabase = await createClient();
  let error;
  if (v.id) ({ error } = await supabase.from('treatment_options').update(row).eq('id', v.id));
  else {
    // New options go to the end of the list
    const { data: last } = await supabase
      .from('treatment_options')
      .select('sort_order')
      .eq('treatment_id', v.treatmentId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await supabase.from('treatment_options').insert({ ...row, sort_order: (last?.sort_order ?? 0) + 10 }));
  }
  if (error) return { ok: false, error: error.code === '23505' ? 'duplicate' : 'generic' };
  await clampMinOptions(supabase, v.treatmentId);
  refreshCatalog();
  return { ok: true };
}

// A treatment can't require more options than it offers (hiding or deleting the last area would make it unbookable)
async function clampMinOptions(supabase: Awaited<ReturnType<typeof createClient>>, treatmentId: string) {
  const [{ data: treatment }, { count }] = await Promise.all([
    supabase.from('treatments').select('min_options').eq('id', treatmentId).single(),
    supabase.from('treatment_options').select('id', { count: 'exact', head: true }).eq('treatment_id', treatmentId).eq('is_active', true).is('deleted_at', null),
  ]);
  if (treatment && count !== null && treatment.min_options > count) {
    await supabase.from('treatments').update({ min_options: count }).eq('id', treatmentId);
  }
}

// Soft delete: past bookings keep pointing at the option. The slug is freed so a new option can reuse it.
export async function deleteOption(id: string): Promise<CatalogResult> {
  if (!(await requireAdminSession())) return { ok: false, error: 'forbidden' };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'invalid' };
  const supabase = await createClient();
  const { data: option } = await supabase.from('treatment_options').select('slug, treatment_id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!option) return { ok: false, error: 'invalid' };
  const { error } = await supabase
    .from('treatment_options')
    .update({ deleted_at: new Date().toISOString(), is_active: false, slug: `${option.slug.slice(0, 60).replace(/-+$/, '')}-deleted-${id.slice(0, 8)}` })
    .eq('id', id);
  if (error) return { ok: false, error: 'generic' };
  await clampMinOptions(supabase, option.treatment_id);
  refreshCatalog();
  return { ok: true };
}

const categorySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isActive: z.boolean(),
});

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<CatalogResult> {
  if (!(await requireAdminSession())) return { ok: false, error: 'forbidden' };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await (await createClient())
    .from('service_categories')
    .update({ name: parsed.data.name, description: parsed.data.description || null, color: parsed.data.color, is_active: parsed.data.isActive })
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'generic' };
  refreshCatalog();
  revalidatePath('/admin/calendar');
  return { ok: true };
}
