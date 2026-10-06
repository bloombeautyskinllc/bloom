import 'server-only';
import type { MenuGroup, MenuItem } from '@/data/treatmentPages';
import { formatMoney } from '@/lib/booking/format';
import { createPublicClient } from '@/lib/supabase/public';

// Site convention: starting prices read "$120+"
const menuPrice = (cents: number, priceType: 'fixed' | 'from') => `${formatMoney(cents)}${priceType === 'from' ? '+' : ''}`;

/**
 * Price menu of a treatment page, straight from the catalog the admin edits (RLS: active rows only).
 * A treatment with options (the laser session) lists each option as its own row, grouped by the
 * option's group label; any other treatment is one row, grouped by its menu group.
 */
export async function getTreatmentMenu(categorySlug: string): Promise<MenuGroup[]> {
  const supabase = createPublicClient();
  const { data: category, error: categoryError } = await supabase.from('service_categories').select('id').eq('slug', categorySlug).maybeSingle();
  if (categoryError) throw new Error(`menu load failed: ${categoryError.message}`);
  if (!category) return [];

  const { data: treatments, error } = await supabase
    .from('treatments')
    .select('id, slug, name, description, menu_group, price_cents, price_type, is_best_seller, min_options')
    .eq('category_id', category.id)
    .order('sort_order');
  if (error) throw new Error(`menu load failed: ${error.message}`);

  const ids = (treatments ?? []).map((t) => t.id);
  const { data: options, error: optionsError } = ids.length
    ? await supabase.from('treatment_options').select('treatment_id, slug, group_label, name, price_cents, price_type').in('treatment_id', ids).order('sort_order')
    : { data: [], error: null };
  if (optionsError) throw new Error(`menu load failed: ${optionsError.message}`);

  const groups = new Map<string, MenuItem[]>();
  const add = (label: string | null, item: MenuItem) => {
    const key = label ?? '';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  };

  for (const t of treatments ?? []) {
    const own = (options ?? []).filter((o) => o.treatment_id === t.id);
    const base: MenuItem = {
      name: t.name,
      price: menuPrice(t.price_cents, t.price_type),
      description: t.description ?? undefined,
      bestSeller: t.is_best_seller,
      book: { treatment: t.slug },
    };
    if (own.length > 0) {
      // Options are optional: the session itself can be booked on its own
      if (t.min_options === 0 && t.price_cents > 0) add(t.menu_group, base);
      for (const o of own) {
        add(o.group_label, {
          name: o.name,
          price: menuPrice(o.price_cents, o.price_type),
          bestSeller: t.is_best_seller,
          book: { treatment: t.slug, option: o.slug },
        });
      }
      continue;
    }
    add(t.menu_group, base);
  }

  return [...groups].map(([label, items]) => ({ label: label || undefined, items }));
}
