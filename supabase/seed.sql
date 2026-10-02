-- =============================================================================
-- BLOOM Beauty Skin: catalog seed
--
-- Source: src/data/treatments.ts and src/data/treatmentPages.ts (the live site),
-- extracted on 2026-09-28. Names, prices and descriptions come verbatim from the site.
--
-- ESTIMATES: the site publishes no durations or buffers. The owner asked for
-- estimates (docs/ARCHITECTURE.md §2.5, §6). Every estimated row is seeded with
-- needs_review = true so the back office highlights it until someone confirms it.
--
-- Conventions
--   * Money is integer cents (USD).
--   * price_type 'from' = the site shows "$X+" (starting price).
--   * Idempotent: keyed by slug, safe to re-run. Re-running does NOT overwrite
--     durations, buffers or needs_review, so back-office edits survive.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
insert into public.service_categories (slug, name, short_name, description, sort_order)
values
  ('facials', 'Facials & Skin Health', 'Facials & skin care',
   'Advanced protocols and clinical-grade technology to restore, oxygenate and revive your complexion.', 10),
  ('brows-lips', 'Brows & Lips', 'Brows & lips',
   'High-precision micropigmentation and lamination that enhance your features, with no daily makeup needed.', 20),
  ('diode-laser', 'Diode Laser Hair Removal', 'Diode laser',
   'Fast, comfortable sessions for smooth, hair-free skin you don''t have to think about.', 30),
  ('intimate-care', 'Intimate Skin Care', 'Intimate care',
   'Gentle, discreet protocols that brighten, renew and restore comfort to your most delicate areas.', 40)
on conflict (slug) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Treatments
-- duration_minutes: ESTIMATE. buffer_after_min: ESTIMATE (15 for all).
-- -----------------------------------------------------------------------------
with t (category_slug, slug, name, description, price_cents, price_type, menu_group, is_best_seller, sort_order, duration_minutes) as (
  values
    -- Facials & Skin Health (site shows no per-item description)
    ('facials', 'microneedling',               'Microneedling',                   null, 25000, 'fixed', null, true,  10, 75),
    ('facials', 'face-peeling-mesopeel',       'Face Peeling (Mesopeel)',         null, 24000, 'fixed', null, false, 20, 60),
    ('facials', 'hydrodermabrasion',           'Hydrodermabrasion Treatment',     null, 18000, 'fixed', null, true,  30, 60),
    ('facials', 'hydrating-facial',            'Hydrating Facial',                null, 18000, 'fixed', null, false, 40, 60),
    ('facials', 'back-facial',                 'Back Facial',                     null, 18000, 'fixed', null, false, 50, 60),
    ('facials', 'dermaplaning',                'Dermaplaning Treatment',          null, 17500, 'fixed', null, true,  60, 45),
    ('facials', 'autumn-glow-facial',          'Autumn Glow Facial',              null, 17500, 'fixed', null, false, 70, 60),
    ('facials', 'oxygen-infusion-facial',      'Oxygen Infusion Facial',          null, 17000, 'fixed', null, false, 80, 60),
    ('facials', 'pumpkin-peel-facial',         'Pumpkin Peel Facial (Vitamin A)', null, 16000, 'fixed', null, false, 90, 60),
    ('facials', 'vitamin-c-facial',            'Vitamin C Facial',                null, 15000, 'fixed', null, false, 100, 60),
    ('facials', 'microdermabrasion',           'Microdermabrasion Treatment',     null, 14000, 'fixed', null, false, 110, 45),
    ('facials', 'skin-revival-facial',         'Skin Revival Facial',             null, 13500, 'fixed', null, false, 120, 60),
    ('facials', 'signature-facial',            'My Signature Facial',             null, 12000, 'from',  null, false, 130, 60),

    -- Brows & Lips
    ('brows-lips', 'shadow-brows',    'Shadow Brows',    'A soft, powdered finish for a defined, filled-in look.',     60000, 'fixed', 'Brows', true,  10, 150),
    ('brows-lips', 'european-brows',  'European Brows',  'Fine hair strokes that recreate natural brow hairs.',        60000, 'fixed', 'Brows', false, 20, 150),
    ('brows-lips', 'laminated-brows', 'Laminated Brows', 'Lifts and sets your natural brows for a brushed-up look.',   11000, 'fixed', 'Brows', false, 30, 45),
    ('brows-lips', 'watercolor-lips', 'Watercolor Lips', 'Sheer, blended color that enhances your natural tone.',      50000, 'fixed', 'Lips',  false, 40, 150),
    ('brows-lips', 'full-lips',       'Full Lips',       'Full, defined color with a perfected lip line.',             60000, 'fixed', 'Lips',  false, 50, 150),
    ('brows-lips', 'korean-lips',     'Korean Lips',     'A soft gradient, deeper at the center, for a fresh look.',   49000, 'fixed', 'Lips',  false, 60, 150),

    -- Diode Laser: ONE bookable session; the client picks one or more areas (options below).
    -- Base price 0 and a 10 min base (prep); areas add their price and duration.
    ('diode-laser', 'diode-laser-session', 'Diode Laser Hair Removal Session',
     'Laser works best as a series of sessions. We’ll recommend the right number for your skin and hair type.',
     0, 'from', null, false, 10, 10),

    -- Intimate Skin Care (depigmentation booked as a single session for now, per owner)
    ('intimate-care', 'vajacial',                     'Vajacial (Intimate Facial)',
     'Deep cleansing for the bikini area: exfoliation, ingrown-hair care and soothing hydration.',        12000, 'fixed', null, true,  10, 45),
    ('intimate-care', 'underarm-depigmentation',      'Underarm Depigmentation',
     'A progressive protocol that lightens dark underarms and evens out skin tone.',                      110000, 'fixed', null, false, 20, 60),
    ('intimate-care', 'intimate-area-depigmentation', 'Intimate Area Depigmentation',
     'Gentle, progressive lightening that restores an even tone to delicate areas.',                      125000, 'fixed', null, false, 30, 60)
)
insert into public.treatments
  (category_id, slug, name, description, price_cents, price_type, menu_group, is_best_seller, sort_order,
   duration_minutes, buffer_before_min, buffer_after_min, includes, needs_review)
select c.id, t.slug, t.name, t.description, t.price_cents, t.price_type::public.price_type, t.menu_group,
       t.is_best_seller, t.sort_order,
       t.duration_minutes, 0, 15,
       '{}'::text[],  -- PENDING: "what's included" is not on the site
       true
from t
join public.service_categories c on c.slug = t.category_slug
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  price_type = excluded.price_type,
  menu_group = excluded.menu_group,
  is_best_seller = excluded.is_best_seller,
  sort_order = excluded.sort_order;

-- The laser session needs at least one area
update public.treatments set min_options = 1 where slug = 'diode-laser-session';

-- -----------------------------------------------------------------------------
-- Treatment options: diode laser areas (all "$X+" on the site => price_type 'from')
-- extra_duration_minutes: ESTIMATE.
-- -----------------------------------------------------------------------------
with o (slug, group_label, name, price_cents, extra_duration_minutes, sort_order) as (
  values
    ('laser-upper-lip',   'Face', 'Upper Lip',    4000,  5,  10),
    ('laser-chin',        'Face', 'Chin',         4500,  5,  20),
    ('laser-sideburns',   'Face', 'Sideburns',    4500,  5,  30),
    ('laser-full-face',   'Face', 'Full Face',    5000,  15, 40),
    ('laser-neck',        'Face', 'Neck',         6000,  10, 50),
    ('laser-beard',       'Face', 'Beard',        8000,  15, 60),
    ('laser-half-leg',    'Body', 'Half Leg',     5000,  20, 110),
    ('laser-underarms',   'Body', 'Underarms',    5500,  10, 120),
    ('laser-full-arm',    'Body', 'Full Arm',     5500,  20, 130),
    ('laser-bikini',      'Body', 'Bikini',       6000,  15, 140),
    ('laser-upper-chest', 'Body', 'Upper Chest',  7000,  15, 150),
    ('laser-full-leg',    'Body', 'Full Leg',     8000,  40, 160),
    ('laser-back',        'Body', 'Back',         10000, 30, 170)
)
insert into public.treatment_options
  (treatment_id, slug, group_label, name, price_cents, price_type, extra_duration_minutes, sort_order, needs_review)
select t.id, o.slug, o.group_label, o.name, o.price_cents, 'from'::public.price_type,
       o.extra_duration_minutes, o.sort_order, true
from o
join public.treatments t on t.slug = 'diode-laser-session'
on conflict (slug) do update set
  group_label = excluded.group_label,
  name = excluded.name,
  price_cents = excluded.price_cents,
  price_type = excluded.price_type,
  sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Business hours (site: "Open Monday to Saturday, 10:00 – 20:00", America/New_York)
-- Business-level default; the specialist inherits it unless given its own schedule.
-- ISO weekday: 1 = Monday ... 7 = Sunday.
-- -----------------------------------------------------------------------------
insert into public.working_hours (specialist_id, iso_weekday, start_time, end_time)
select null, d, time '10:00', time '20:00'
from generate_series(1, 6) as d
where not exists (select 1 from public.working_hours where specialist_id is null);

-- -----------------------------------------------------------------------------
-- The single specialist (owner confirmed there is one). Display name is the
-- business name until the owner sets a real one in the back office.
-- -----------------------------------------------------------------------------
insert into public.specialists (display_name, needs_review)
select 'BLOOM Beauty Skin', true
where not exists (select 1 from public.specialists);

insert into public.specialist_treatments (specialist_id, treatment_id)
select s.id, t.id
from public.specialists s
cross join public.treatments t
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Business settings (single row). Policy values are ESTIMATES, editable.
-- payments_enabled stays false until Stripe keys exist: bookings then confirm directly.
-- -----------------------------------------------------------------------------
insert into public.business_settings (
  id, business_name, timezone, address_line1, address_line2,
  slot_interval_min, min_notice_min, max_window_days, hold_minutes,
  cancel_cutoff_hours, reschedule_cutoff_hours, max_reschedules,
  reminder_offsets_min, payments_enabled
)
values (
  1, 'BLOOM Beauty Skin', 'America/New_York', '305 E 204th St, Suite 2A', 'Bronx, NY 10467',
  15, 120, 60, 10,
  24, 24, 2,
  '{1440,120}', false
)
on conflict (id) do nothing;
