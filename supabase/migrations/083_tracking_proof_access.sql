-- FEAT-TRK-001: authorize the event and shipment before returning any file reference.
create or replace function public.provider_tracking_proof_file(
  actor_user_id uuid,target_shipment_id uuid,target_event_id uuid,
  requested_recipient_digest text default null
)
returns jsonb language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare authorized boolean:=false; result jsonb;
begin
  if actor_user_id is not null then
    authorized:=public.managed_actor_has_permission(actor_user_id,'OPERATIONS')
      or public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id);
  end if;
  if not authorized and nullif(requested_recipient_digest,'') is not null then
    authorized:=public.provider_guest_tracking_for_recipient(target_shipment_id,requested_recipient_digest) is not null;
  end if;
  if not authorized then return null; end if;
  select jsonb_build_object('storage_path',event.proof_storage_path,
    'original_name',event.proof_original_name,'mime_type',event.proof_mime_type)
  into result from public.provider_shipment_events event
  where event.id=target_event_id and event.shipment_id=target_shipment_id
    and event.proof_storage_path like 'supabase://shipment-proof/%'
    and event.proof_mime_type in ('image/jpeg','image/png','image/webp');
  return result;
end;
$$;
revoke all on function public.provider_tracking_proof_file(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.provider_tracking_proof_file(uuid,uuid,uuid,text) to service_role;

create or replace function public.provider_guest_tracking_for_recipient(
  target_shipment_id uuid,
  requested_recipient_digest text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  recipient_role text;
  result jsonb;
begin
  select party.recipient_role into recipient_role
  from public.provider_tracking_recipients party
  join public.shipment_party_grants grant_record
    on grant_record.shipment_id=party.shipment_id and grant_record.party_role='SHIPPER'
  join public.provider_shipments shipment on shipment.id=party.shipment_id
  where party.shipment_id=target_shipment_id
    and party.recipient_email_digest=requested_recipient_digest
    and party.revoked_at is null
    and grant_record.revoked_at is null
    and (grant_record.expires_at is null or grant_record.expires_at>now())
    and (shipment.guest_expires_at is null or shipment.guest_expires_at>now())
  order by party.created_at desc,party.id
  limit 1;
  if not found then return null; end if;

  result:=public.provider_guest_tracking(target_shipment_id,'SHIPPER');
  if result is null then return null; end if;
  result:=result||jsonb_build_object(
    'recipient_role',recipient_role,
    'party_role',case when recipient_role='OWNER' then 'SHIPPER' else 'RECEIVER' end,
    'can_review',case when recipient_role='OWNER' then coalesce((result->>'can_review')::boolean,false) else false end,
    'review',case when recipient_role='OWNER' then result->'review' else null end
  );
  -- Expose only proof availability for already-authorized event IDs, never paths.
  result:=jsonb_set(result,'{events}',coalesce((
    select jsonb_agg(entry.value||jsonb_build_object('has_proof',exists(
      select 1 from public.provider_shipment_events event
      where event.id=(entry.value->>'id')::uuid and event.shipment_id=target_shipment_id
        and event.proof_storage_path is not null
    )) order by entry.ordinality)
    from jsonb_array_elements(result->'events') with ordinality as entry(value,ordinality)
  ),'[]'::jsonb));
  return result;
end;
$$;
