'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type TeamResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'not_found' | 'last_admin' | 'generic' };

async function isAdmin() {
  return (await getSession())?.profile.role === 'admin';
}

function refresh() {
  for (const p of ['/admin/team', '/admin/calendar', '/booking']) revalidatePath(p);
}

const specialistSchema = z.object({
  id: z.uuid().optional(),
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(600).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isActive: z.boolean(),
  treatmentIds: z.array(z.uuid()).max(200),
});

export async function saveSpecialist(input: z.input<typeof specialistSchema>): Promise<TeamResult> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const parsed = specialistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v = parsed.data;
  const supabase = await createClient();
  const row = { display_name: v.displayName, bio: v.bio || null, color: v.color, is_active: v.isActive, needs_review: false };
  const { data, error } = v.id
    ? await supabase.from('specialists').update(row).eq('id', v.id).select('id').single()
    : await supabase.from('specialists').insert(row).select('id').single();
  if (error || !data) return { ok: false, error: 'generic' };

  // Replace the "performs" list
  await supabase.from('specialist_treatments').delete().eq('specialist_id', data.id);
  if (v.treatmentIds.length) {
    const { error: linkError } = await supabase.from('specialist_treatments').insert(v.treatmentIds.map((t) => ({ specialist_id: data.id, treatment_id: t })));
    if (linkError) return { ok: false, error: 'generic' };
  }
  refresh();
  return { ok: true };
}

const hoursSchema = z.object({
  specialistId: z.uuid().nullable(),
  hours: z
    .array(z.object({ isoWeekday: z.number().int().min(1).max(7), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }))
    .max(50)
    .refine((list) => list.every((h) => h.end > h.start), 'end_before_start'),
});

export async function saveWorkingHours(input: z.input<typeof hoursSchema>): Promise<TeamResult> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await (await createClient()).rpc('admin_set_working_hours', {
    p_specialist_id: parsed.data.specialistId as string,
    p_hours: parsed.data.hours.map((h) => ({ iso_weekday: h.isoWeekday, start: h.start, end: h.end })),
  });
  if (error) return { ok: false, error: 'generic' };
  refresh();
  return { ok: true };
}

const blockSchema = z.object({
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  specialistId: z.uuid().nullable(),
  reason: z.string().trim().max(200).optional(),
});

export async function addBlock(input: z.input<typeof blockSchema>): Promise<TeamResult> {
  const session = await getSession();
  if (session?.profile.role !== 'admin') return { ok: false, error: 'forbidden' };
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success || Date.parse(parsed.data.end) <= Date.parse(parsed.data.start)) return { ok: false, error: 'invalid' };
  const { error } = await (await createClient()).from('availability_blocks').insert({
    range: `[${parsed.data.start},${parsed.data.end})`,
    specialist_id: parsed.data.specialistId,
    reason: parsed.data.reason || null,
    source: 'manual',
    created_by: session.profile.id,
  });
  if (error) return { ok: false, error: 'generic' };
  refresh();
  return { ok: true };
}

export async function removeBlock(blockId: string): Promise<TeamResult> {
  if (!(await isAdmin()) || !z.uuid().safeParse(blockId).success) return { ok: false, error: 'forbidden' };
  // Google blocks come back on the next sync: they are removed by deleting the event in Google
  const { error } = await (await createClient()).from('availability_blocks').update({ deleted_at: new Date().toISOString() }).eq('id', blockId).neq('source', 'google');
  if (error) return { ok: false, error: 'generic' };
  refresh();
  return { ok: true };
}

export async function setRole(input: { profileId: string; role: 'client' | 'staff' | 'admin' }): Promise<TeamResult> {
  if (!(await isAdmin())) return { ok: false, error: 'forbidden' };
  const parsed = z.object({ profileId: z.uuid(), role: z.enum(['client', 'staff', 'admin']) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await (await createClient()).rpc('admin_set_role', { p_profile_id: parsed.data.profileId, p_role: parsed.data.role });
  if (error) return { ok: false, error: error.message === 'cannot remove the last admin' ? 'last_admin' : 'generic' };
  revalidatePath('/admin/team');
  return { ok: true };
}

export async function findPersonByEmail(email: string): Promise<{ id: string; name: string | null; role: string } | null> {
  if (!(await isAdmin())) return null;
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return null;
  const { data } = await (await createClient()).from('profiles').select('id, full_name, role').eq('email', parsed.data).is('deleted_at', null).maybeSingle();
  return data ? { id: data.id, name: data.full_name, role: data.role } : null;
}
