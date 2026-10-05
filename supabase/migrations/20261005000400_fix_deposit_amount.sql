-- =============================================================================
-- Fix: the deposit was always the full price. least() ignores nulls in PostgreSQL, so
-- least(deposit_cents, total) returned the total when the treatment has no fixed deposit and the
-- percentage was never used. Bookings already waiting for payment keep their amount.
-- =============================================================================

create or replace function public.hold_slot(
  p_treatment_id    uuid,
  p_option_ids      uuid[],
  p_start_at        timestamptz,
  p_specialist_id   uuid default null,
  p_idempotency_key text default null
)
returns table (booking_id uuid, code text, hold_expires_at timestamptz, start_at timestamptz, end_at timestamptz, total_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_profile    public.profiles;
  v_settings   public.business_settings;
  v_treatment  public.treatments;
  v_option_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(p_option_ids) x), '{}');
  v_opt_count  integer;
  v_opt_price  integer;
  v_opt_min    integer;
  v_opt_nulls  integer;
  v_duration   integer;
  v_total      integer;
  v_end        timestamptz;
  v_specialist uuid;
  v_id         uuid;
begin
  select * into v_profile from public.profiles p where p.user_id = auth.uid() and p.deleted_at is null;
  if not found then raise exception 'not_authenticated'; end if;
  if v_profile.onboarded_at is null then raise exception 'onboarding_required'; end if;

  -- Retrying the same request returns the same hold
  if p_idempotency_key is not null then
    return query
      select b.id, b.code, b.hold_expires_at, b.start_at, b.end_at, b.total_cents
      from public.bookings b
      where b.idempotency_key = p_idempotency_key and b.client_id = v_profile.id
        and b.status in ('held', 'pending_payment', 'confirmed');
    if found then return; end if;
  end if;

  select * into v_settings from public.business_settings where id = 1;
  select * into v_treatment from public.treatments t where t.id = p_treatment_id and t.is_bookable;
  if not found then raise exception 'not_bookable'; end if;

  select count(*), coalesce(sum(o.price_cents), 0), coalesce(sum(o.extra_duration_minutes), 0),
         count(*) filter (where o.extra_duration_minutes is null)
    into v_opt_count, v_opt_price, v_opt_min, v_opt_nulls
  from public.treatment_options o
  where o.id = any (v_option_ids) and o.treatment_id = v_treatment.id and o.is_active and o.deleted_at is null;

  if v_opt_count <> cardinality(v_option_ids)
     or v_opt_nulls > 0
     or v_opt_count < v_treatment.min_options
     or (v_treatment.max_options is not null and v_opt_count > v_treatment.max_options) then
    raise exception 'invalid_options';
  end if;

  -- Price and duration are always computed here, never taken from the client
  v_duration := v_treatment.duration_minutes + v_opt_min;
  v_total := v_treatment.price_cents + v_opt_price;
  v_end := p_start_at + make_interval(mins => v_duration);

  perform private.assert_booking_window(p_start_at, v_settings);
  perform private.begin_trusted_rpc();

  -- One active hold per client: picking a new time releases the previous one
  update public.bookings b set status = 'expired'
   where b.client_id = v_profile.id and b.status = 'held';

  for v_specialist in
    select s.id from public.specialists s
    join public.specialist_treatments st on st.specialist_id = s.id and st.treatment_id = v_treatment.id
    where s.is_active and s.deleted_at is null and (p_specialist_id is null or s.id = p_specialist_id)
    order by s.sort_order, s.created_at
  loop
    continue when not private.specialist_fits(
      v_specialist, p_start_at, v_end, v_treatment.buffer_before_min, v_treatment.buffer_after_min, v_settings.timezone);

    perform private.expire_overlapping_holds(
      v_specialist,
      tstzrange(p_start_at - make_interval(mins => v_treatment.buffer_before_min), v_end + make_interval(mins => v_treatment.buffer_after_min), '[)'));

    begin
      insert into public.bookings (
        client_id, specialist_id, status, source, start_at, end_at, buffer_before_min, buffer_after_min,
        hold_expires_at, idempotency_key, subtotal_cents, total_cents, amount_due_cents, policy, created_by
      ) values (
        v_profile.id, v_specialist, 'held', 'online', p_start_at, v_end, v_treatment.buffer_before_min, v_treatment.buffer_after_min,
        now() + make_interval(mins => v_settings.hold_minutes), p_idempotency_key, v_total, v_total,
        case when v_treatment.deposit_cents is not null then least(v_treatment.deposit_cents, v_total)
             else round(v_total * coalesce(v_treatment.deposit_percent, v_settings.deposit_percent) / 100.0)::int end, private.policy_snapshot(v_settings), v_profile.id
      )
      returning id into v_id;
      exit;
    exception when exclusion_violation then
      v_id := null; -- taken: try the next specialist
    end;
  end loop;

  if v_id is null then raise exception 'slot_taken'; end if;

  insert into public.booking_items (booking_id, kind, treatment_id, name, description, includes, price_type, unit_price_cents, duration_minutes, sort_order)
  values (v_id, 'treatment', v_treatment.id, v_treatment.name, v_treatment.description, v_treatment.includes,
          v_treatment.price_type, v_treatment.price_cents, v_treatment.duration_minutes, 0);

  insert into public.booking_items (booking_id, kind, treatment_id, option_id, name, description, group_label, price_type, unit_price_cents, duration_minutes, sort_order)
  select v_id, 'option', v_treatment.id, o.id, o.name, o.description, o.group_label, o.price_type, o.price_cents, o.extra_duration_minutes, 1 + o.sort_order
  from public.treatment_options o
  where o.id = any (v_option_ids);

  return query
    select b.id, b.code, b.hold_expires_at, b.start_at, b.end_at, b.total_cents
    from public.bookings b where b.id = v_id;
end;
$$;
