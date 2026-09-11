-- BASE-DEP-001 / FEAT-GST-001 / FEAT-TRK-001 / FEAT-PRV-001
-- Keep buffered binary uploads below Netlify's effective 4.5 MB request limit.

update storage.buckets
set file_size_limit=4194304
where id in (
  'shipment-proof',
  'verification',
  'capacity-photo',
  'payment-proof',
  'provider-profile',
  'support-attachment',
  'private-upload-quarantine'
);

create or replace function public.update_provider_profile_image(
  actor_user_id uuid,
  storage_reference text,
  mime_type text,
  file_size integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  page public.company_pages%rowtype;
  prior_reference text;
begin
  select * into actor from public.provider_profile_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN'; end if;
  if storage_reference!~'^supabase://provider-profile/provider-profile/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]+\.(jpg|png|webp)$'
    or mime_type not in ('image/jpeg','image/png','image/webp')
    or file_size<1 or file_size>4194304 then raise exception 'PROFILE_IMAGE_TYPE_INVALID'; end if;

  select * into page from public.company_pages candidate
  where candidate.organization_id=actor.organization_id
     or candidate.provider_profile_id=actor.provider_profile_id
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  prior_reference:=page.profile_image_path;

  update public.company_pages set profile_image_path=storage_reference,profile_image_mime=mime_type,
    profile_image_updated_at=now(),updated_at=now() where id=page.id;
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'PROVIDER_PROFILE_IMAGE_UPDATED','company_page',page.id,
    jsonb_build_object('mimeType',mime_type,'size',file_size),now());
  return jsonb_build_object('page_id',page.id,'previous_reference',prior_reference);
end;
$$;

comment on function public.update_provider_profile_image(uuid,text,text,integer) is
  'Replaces provider profile image metadata after central scanning; accepts at most 4 MiB.';
