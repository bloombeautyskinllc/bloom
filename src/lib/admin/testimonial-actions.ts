'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { testimonialPlacements } from '@/data/testimonials';
import { getSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export type TestimonialResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'generic' };

const BUCKET = 'testimonials';

async function isAdmin() {
  return (await getSession())?.profile.role === 'admin';
}

// The home page and every treatment page show testimonials
function refresh() {
  revalidatePath('/admin/testimonials');
  revalidatePath('/');
  revalidatePath('/(marketing)/treatments/[slug]', 'page');
}

const publicPrefix = () => `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const testimonialSchema = z
  .object({
    id: z.uuid().optional(),
    quote: z.string().trim().min(2).max(200),
    body: z.string().trim().min(2).max(1000),
    treatment: z.string().trim().max(80).optional(),
    tag: z.string().trim().max(40).optional(),
    rating: z.number().int().min(1).max(5),
    imageUrl: z.string().trim().min(1).max(500),
    imageAlt: z.string().trim().max(200).optional(),
    // Set when the photo was uploaded to the bucket; null for site assets ('/images/...')
    storagePath: z.string().regex(/^[\w-]+\.(jpe?g|png|webp)$/).nullable(),
    placements: z.array(z.enum(testimonialPlacements.map((p) => p.id) as [string, ...string[]])).max(10),
    isActive: z.boolean(),
  })
  // The photo is either a site asset or exactly the uploaded file's public URL
  .refine((v) => (v.storagePath ? v.imageUrl === publicPrefix() + v.storagePath : /^\/images\/[\w/.-]+$/.test(v.imageUrl)));

export async function saveTestimonial(input: z.input<typeof testimonialSchema>): Promise<TestimonialResult> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v = parsed.data;
  const supabase = await createClient();
  const row = {
    quote: v.quote.replace(/^["“]+|["”]+$/g, ''),
    body: v.body,
    treatment: v.treatment || null,
    tag: v.tag || null,
    rating: v.rating,
    image_url: v.imageUrl,
    image_alt: v.imageAlt || null,
    storage_path: v.storagePath,
    placements: [...new Set(v.placements)],
    is_active: v.isActive,
  };

  if (v.id) {
    const { data: before } = await supabase.from('testimonials').select('storage_path').eq('id', v.id).maybeSingle();
    const { error } = await supabase.from('testimonials').update(row).eq('id', v.id);
    if (error) return { ok: false, error: 'generic' };
    // The photo was replaced: drop the old upload
    if (before?.storage_path && before.storage_path !== v.storagePath) await supabase.storage.from(BUCKET).remove([before.storage_path]);
  } else {
    // New stories go last
    const { data: last } = await supabase.from('testimonials').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from('testimonials').insert({ ...row, sort_order: (last?.sort_order ?? 0) + 10 });
    if (error) return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

export async function deleteTestimonial(id: string): Promise<TestimonialResult> {
  if (!(await isAdmin()) || !z.uuid().safeParse(id).success) return { ok: false, error: 'forbidden' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('testimonials').delete().eq('id', id).select('storage_path').maybeSingle();
  if (error) return { ok: false, error: 'generic' };
  if (data?.storage_path) await supabase.storage.from(BUCKET).remove([data.storage_path]);
  refresh();
  return { ok: true };
}

/** Saves the display order: `ids` is the full list, first shown first */
export async function reorderTestimonials(ids: string[]): Promise<TestimonialResult> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const parsed = z.array(z.uuid()).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const supabase = await createClient();
  const results = await Promise.all(parsed.data.map((id, i) => supabase.from('testimonials').update({ sort_order: (i + 1) * 10 }).eq('id', id)));
  if (results.some((r) => r.error)) return { ok: false, error: 'generic' };
  refresh();
  return { ok: true };
}
