-- =============================================================================
-- Legal / policy settings and the public settings RPC
--
-- The Terms and Privacy pages read these values, so the published policy always
-- matches the rules the booking engine enforces.
-- =============================================================================

alter table public.business_settings
  add column legal_name                       text not null default 'Bloom Beauty Skin LLC',
  add column privacy_email                    text not null default 'privacy@bloombeautyskinllc.com',
  -- Refund when the client cancels with at least cancel_cutoff_hours of notice (owner decision 2026-09-28: a percentage)
  add column cancellation_refund_percent      integer not null default 90 check (cancellation_refund_percent between 0 and 100),
  -- Late cancellation (inside the cutoff) or no-show (owner decision 2026-09-28: no refund)
  add column late_cancellation_refund_percent integer not null default 0 check (late_cancellation_refund_percent between 0 and 100),
  -- Minors may be treated with a parent or legal guardian's consent (owner decision 2026-09-28)
  add column minors_allowed_with_guardian     boolean not null default true;

-- Everything a visitor may see: booking rules, policy values and contact details.
-- Excludes internal fields such as admin alert recipients.
create function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', s.business_name,
    'legal_name', s.legal_name,
    'timezone', s.timezone,
    'address_line1', s.address_line1,
    'address_line2', s.address_line2,
    'phone_e164', s.phone_e164,
    'whatsapp_e164', s.whatsapp_e164,
    'public_email', s.public_email,
    'privacy_email', s.privacy_email,
    'slot_interval_min', s.slot_interval_min,
    'min_notice_min', s.min_notice_min,
    'max_window_days', s.max_window_days,
    'hold_minutes', s.hold_minutes,
    'cancel_cutoff_hours', s.cancel_cutoff_hours,
    'reschedule_cutoff_hours', s.reschedule_cutoff_hours,
    'max_reschedules', s.max_reschedules,
    'cancellation_refund_percent', s.cancellation_refund_percent,
    'late_cancellation_refund_percent', s.late_cancellation_refund_percent,
    'minors_allowed_with_guardian', s.minors_allowed_with_guardian,
    'payments_enabled', s.payments_enabled,
    'terms_version', s.terms_version
  )
  from public.business_settings s
  where s.id = 1;
$$;

grant execute on function public.get_public_settings() to anon, authenticated;
