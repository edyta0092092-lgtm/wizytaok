create or replace function public.get_booking_by_confirmation_token (p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_obj jsonb;
  v_business_id uuid;
  v_slug text;
begin
  if v_token = '' then
    return null;
  end if;

  -- Compatibility across schemas:
  -- - confirmation_token can be text or uuid
  -- - some deployments can differ in optional columns
  select to_jsonb(b) into v_obj
  from public.bookings b
  where (
    coalesce(nullif(to_jsonb(b)->>'confirmation_token', ''), '') = v_token
    or b.id::text = v_token
  )
  limit 1;

  if v_obj is null then
    return null;
  end if;

  v_business_id := nullif(v_obj->>'business_id', '')::uuid;

  if v_business_id is not null then
    select bp.slug into v_slug
    from public.business_profiles bp
    where bp.id = v_business_id
    limit 1;
  end if;

  return jsonb_build_object(
    'id', v_obj->>'id',
    'business_id', v_obj->>'business_id',
    'confirmation_token', v_obj->>'confirmation_token',
    'business_slug', coalesce(v_slug, ''),
    'service_id', v_obj->>'service_id',
    'service_name', v_obj->>'service_name',
    'service_duration_minutes', (v_obj->>'service_duration_minutes'),
    'service_price', (v_obj->>'service_price'),
    'service_currency', v_obj->>'service_currency',
    'staff_id', v_obj->>'staff_id',
    'staff_name', v_obj->>'staff_name',
    'proposed_staff_id', v_obj->>'proposed_staff_id',
    'proposed_staff_name', v_obj->>'proposed_staff_name',
    'appointment_date', v_obj->>'appointment_date',
    'appointment_time', v_obj->>'appointment_time',
    'status', v_obj->>'status',
    'source', v_obj->>'source',
    'client_name', v_obj->>'client_name',
    'client_phone', v_obj->>'client_phone',
    'client_email', v_obj->>'client_email',
    'customer_note', v_obj->>'customer_note',
    'business_note', v_obj->>'business_note',
    'proposed_date', v_obj->>'proposed_date',
    'proposed_time', v_obj->>'proposed_time',
    'proposed_service_id', v_obj->>'proposed_service_id',
    'proposed_service_name', v_obj->>'proposed_service_name',
    'proposed_service_duration_minutes', v_obj->>'proposed_service_duration_minutes',
    'proposed_service_price', v_obj->>'proposed_service_price',
    'previous_date', v_obj->>'previous_date',
    'previous_time', v_obj->>'previous_time',
    'previous_service_name', v_obj->>'previous_service_name',
    'previous_service_duration_minutes', v_obj->>'previous_service_duration_minutes',
    'previous_service_price', v_obj->>'previous_service_price',
    'status_before_request', v_obj->>'status_before_request',
    'reschedule_message', v_obj->>'reschedule_message',
    'internal_note', v_obj->>'internal_note',
    'last_updated_by', v_obj->>'last_updated_by',
    'last_change_type', v_obj->>'last_change_type',
    'last_status_change_source', v_obj->>'last_status_change_source',
    'accepted_proposal_at', v_obj->>'accepted_proposal_at',
    'business_proposal_kind', v_obj->>'business_proposal_kind',
    'reminder_due_at', v_obj->>'reminder_due_at',
    'reminder_sent_at', v_obj->>'reminder_sent_at',
    'reminder_status', v_obj->>'reminder_status',
    'created_at', v_obj->>'created_at',
    'updated_at', v_obj->>'updated_at'
  );
end;
$$;
