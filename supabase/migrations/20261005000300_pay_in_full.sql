-- =============================================================================
-- The client chooses at booking whether to pay the deposit or the full price online.
-- The amount is set here, server-side: the client only sends the choice.
-- =============================================================================

drop function public.submit_booking(uuid, text, jsonb);
create function public.submit_booking(
  p_booking_id uuid,
  p_notes      text default null,
  p_intake     jsonb default null,
  p_pay_full   boolean default false
)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking  public.bookings;
  v_settings public.business_settings;
  v_form     public.intake_forms;
  v_due      integer;
begin
  select b.* into v_booking from public.bookings b
  join public.profiles p on p.id = b.client_id
  where b.id = p_booking_id and p.user_id = auth.uid()
  for update of b;
  if not found then raise exception 'not_found'; end if;
  if v_booking.status <> 'held' then raise exception 'not_held'; end if;
  if v_booking.hold_expires_at < now() then raise exception 'hold_expired'; end if;

  select f.* into v_form
  from public.booking_items i
  join public.treatments t on t.id = i.treatment_id
  join public.intake_forms f on f.id = t.intake_form_id
  where i.booking_id = p_booking_id and i.kind = 'treatment';

  if found then
    if p_intake is null or jsonb_typeof(p_intake) <> 'object' then raise exception 'intake_required'; end if;
    insert into public.intake_responses (booking_id, form_id, form_version, answers)
    values (p_booking_id, v_form.id, v_form.version, p_intake)
    on conflict (booking_id) do update set answers = excluded.answers, submitted_at = now();
  end if;

  select * into v_settings from public.business_settings where id = 1;
  perform private.begin_trusted_rpc();

  -- The client may pay the full price instead of the deposit
  v_due := case when p_pay_full then v_booking.total_cents else v_booking.amount_due_cents end;

  if v_settings.payments_enabled and v_due > 0 then
    -- 30 minutes to pay; when it runs out the link is deleted and the slot released
    update public.bookings
       set status = 'pending_payment', payment_status = 'pending', amount_due_cents = v_due,
           client_notes = nullif(trim(p_notes), ''), hold_expires_at = now() + interval '30 minutes'
     where id = p_booking_id;
    return 'pending_payment'::public.booking_status;
  end if;

  update public.bookings
     set status = 'confirmed', confirmed_at = now(), hold_expires_at = null,
         client_notes = nullif(trim(p_notes), '')
   where id = p_booking_id;
  return 'confirmed'::public.booking_status;
end;
$$;

grant execute on function public.submit_booking(uuid, text, jsonb, boolean) to authenticated;
