-- =============================================================================
-- Client testimonials shown on the home page and the treatment pages.
--
-- One row per testimonial; `placements` lists the pages it appears on ('home' or a
-- treatment page slug), so the same story can show on several pages without copies.
-- Photos are either site assets ('/images/...') or files in the public "testimonials"
-- bucket uploaded from admin > Testimonials (then `storage_path` is set for cleanup).
--
-- Read access: anyone reads active rows; staff read everything.
-- Write access: admins only. Audited.
-- =============================================================================

create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  quote        text not null check (length(quote) between 2 and 200),
  body         text not null check (length(body) between 2 and 1000),
  treatment    text check (treatment is null or length(treatment) <= 80),
  tag          text check (tag is null or length(tag) <= 40),
  rating       smallint not null default 5 check (rating between 1 and 5),
  image_url    text not null,
  image_alt    text check (image_alt is null or length(image_alt) <= 200),
  storage_path text,
  placements   text[] not null default '{}'
               check (placements <@ array['home', 'facials', 'brows-lips', 'diode-laser', 'intimate-care']),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index testimonials_placements_idx on public.testimonials using gin (placements);

create trigger testimonials_set_updated_at before update on public.testimonials
  for each row execute function private.set_updated_at();
create trigger testimonials_audit after insert or update or delete on public.testimonials
  for each row execute function private.audit_row();

alter table public.testimonials enable row level security;

create policy "testimonials: public reads active" on public.testimonials for select to anon, authenticated
  using (is_active or (select private.is_staff()));
create policy "testimonials: admins insert" on public.testimonials for insert to authenticated
  with check ((select private.is_admin()));
create policy "testimonials: admins update" on public.testimonials for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "testimonials: admins delete" on public.testimonials for delete to authenticated
  using ((select private.is_admin()));

revoke all on public.testimonials from anon;
grant select on public.testimonials to anon;

-- -----------------------------------------------------------------------------
-- Public bucket for testimonial photos (served by public URL, written by admins)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('testimonials', 'testimonials', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "testimonials: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'testimonials' and (select private.is_admin()));
create policy "testimonials: admins update files" on storage.objects for update to authenticated
  using (bucket_id = 'testimonials' and (select private.is_admin()));
create policy "testimonials: admins delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'testimonials' and (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Seed: the approved stories. Each shows on its treatment page; the home page and
-- Intimate Skin Care (no stories of its own yet) show all of them.
-- -----------------------------------------------------------------------------
insert into public.testimonials (quote, body, treatment, image_url, image_alt, placements, sort_order) values
  ('My skin has never looked this healthy.',
   'From the first consultation I felt listened to. They explained every step, adjusted the plan to my skin, and the results speak for themselves: brighter, smoother, more even. I wouldn''t trust my face with anyone else.',
   'Facial Treatment', '/images/testimonials/facial-1.webp', 'Client relaxing after a facial treatment',
   array['home', 'facials', 'intimate-care'], 10),
  ('I can finally wear sleeveless tops again.',
   'I had tried creams for years with no real change. After my sessions the darkness faded, the skin feels smooth and even, and I no longer think twice before raising my arms. The team was kind, discreet, and honest about the timeline, and they delivered exactly what they promised.',
   null, '/images/testimonials/laser-1.webp', 'Underarm before and after diode laser sessions',
   array['home', 'diode-laser', 'intimate-care'], 20),
  ('I wake up with color already on my lips.',
   'The shade was matched to my natural tone, so it looks like me on a good day, not like lipstick. The process was far more comfortable than I expected, and the healed result is soft and even.',
   'Lip Treatment', '/images/testimonials/lips-1.webp', 'Healed lip blush in a natural rose tone',
   array['home', 'brows-lips', 'intimate-care'], 30),
  ('I finally stopped hiding behind filters.',
   'The texture, the tone, the glow, everything improved more than I expected. What impressed me most was the attention to detail and how carefully they followed up after each session. It feels like real care, not just a service.',
   'Facial Treatment', '/images/testimonials/facial-2.webp', 'Client with glowing skin after a facial',
   array['home', 'facials', 'intimate-care'], 40),
  ('I look rested, even when I''m not.',
   'People keep asking if I''ve been on vacation. The team was honest about what to expect, never pushed extra treatments, and gave me an aftercare routine I could actually keep up with. Worth every session.',
   'Facial Treatment', '/images/testimonials/facial-3.webp', 'Client during a facial treatment',
   array['home', 'facials', 'intimate-care'], 50),
  ('Professional from start to finish.',
   'The space is spotless, appointments run on time, and you can tell they truly know skin. My redness is gone and my complexion looks calm and polished, even without makeup. I''ve already booked my next visit.',
   'Facial Treatment', '/images/testimonials/facial-4.webp', 'Profile of a client with calm, even skin after a facial',
   array['home', 'facials', 'intimate-care'], 60);
