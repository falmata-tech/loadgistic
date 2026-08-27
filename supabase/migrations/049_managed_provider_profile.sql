-- BASE-BE-001 / FEAT-PRV-001
-- Actor-scoped transporter profile editing. Browser roles cannot call these
-- actor-id functions or receive private storage references.

create or replace function public.provider_profile_actor_scope(actor_user_id uuid)
returns table(
  actor_role text,
  organization_id uuid,
  provider_profile_id uuid,
  is_company_driver boolean,
  workspace_access boolean
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    profile.role::text,
    membership.organization_id,
    provider.id,
    profile.role::text='DRIVER' and membership.organization_id is not null,
    exists(
      select 1
      from public.subscriptions subscription
      where (subscription.organization_id=membership.organization_id
          or subscription.provider_profile_id=provider.id)
        and (
          subscription.status='SPONSORED'
          or subscription.status in ('TRIAL','ACTIVE') and subscription.ends_at>now()
        )
    )
  from public.profiles profile
  left join lateral (
    select member.organization_id
    from public.organization_members member
    where member.user_id=profile.id
    order by case when member.membership_role='OWNER' then 0 else 1 end,member.id
    limit 1
  ) membership on true
  left join public.provider_profiles provider on provider.user_id=profile.id
  where profile.id=actor_user_id
    and profile.active
    and profile.role::text in ('TRANSPORTER','DRIVER')
$$;

create or replace function public.provider_profile_workspace(actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  result jsonb;
begin
  select * into actor from public.provider_profile_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'id',page.id,
    'owner_id',coalesce(page.organization_id,page.provider_profile_id),
    'page_kind',case when page.organization_id is not null then 'organization' else 'provider' end,
    'name',coalesce(organization.name,provider.business_name),
    'handle',coalesce(organization.handle,provider.handle),
    'city',coalesce(organization.city,provider.city),
    'city_place_ref',coalesce(organization.city_place_ref,provider.city_place_ref),
    'headline',page.headline,
    'about',page.about,
    'services',page.services,
    'base_region_code',page.base_region_code,
    'contact_phone',page.contact_phone,
    'contact_whatsapp',page.contact_whatsapp,
    'contact_email',page.contact_email,
    'contact_website',page.contact_website,
    'show_contact_phone',page.show_contact_phone,
    'show_contact_whatsapp',page.show_contact_whatsapp,
    'show_contact_email',page.show_contact_email,
    'show_contact_website',page.show_contact_website,
    'published',page.published,
    'profile_image_is_custom',page.profile_image_path is not null,
    'profile_image_updated_at',page.profile_image_updated_at,
    'profile_image_preset',page.profile_image_preset
  ) into result
  from public.company_pages page
  left join public.organizations organization on organization.id=page.organization_id
  left join public.provider_profiles provider on provider.id=page.provider_profile_id
  where page.organization_id=actor.organization_id
     or page.provider_profile_id=actor.provider_profile_id;

  if result is null then raise exception 'NOT_FOUND'; end if;
  return result;
end;
$$;

create or replace function public.update_provider_profile_page(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  page public.company_pages%rowtype;
  requested_place_ref text:=nullif(trim(coalesce(command->>'base_place_ref','')),'');
  region_code text;
  headline_value text:=trim(coalesce(command->>'headline',''));
  about_value text:=trim(coalesce(command->>'about',''));
  services_value text:=trim(coalesce(command->>'services',''));
  phone_value text:=trim(coalesce(command->>'contact_phone',''));
  whatsapp_value text:=trim(coalesce(command->>'contact_whatsapp',''));
  email_value text:=trim(coalesce(command->>'contact_email',''));
  website_value text:=trim(coalesce(command->>'contact_website',''));
  show_phone boolean:=coalesce((command->>'show_contact_phone')::boolean,false);
  show_whatsapp boolean:=coalesce((command->>'show_contact_whatsapp')::boolean,false);
  show_email boolean:=coalesce((command->>'show_contact_email')::boolean,false);
  show_website boolean:=coalesce((command->>'show_contact_website')::boolean,false);
  published_value boolean:=coalesce((command->>'published')::boolean,false);
  place record;
  current_place_ref text;
begin
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_PROVIDER_PROFILE_INPUT'; end if;
  select * into actor from public.provider_profile_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then
    raise exception 'FORBIDDEN';
  end if;

  select * into page from public.company_pages candidate
  where candidate.organization_id=actor.organization_id
     or candidate.provider_profile_id=actor.provider_profile_id
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  region_code:=upper(nullif(trim(coalesce(command->>'base_region_code',page.base_region_code,'')),''));
  if region_code is not null and region_code not in (
    'ADDIS_ABABA','AFAR','AMHARA','BENISHANGUL_GUMUZ','CENTRAL_ETHIOPIA','DIRE_DAWA','GAMBELLA',
    'HARARI','OROMIA','SIDAMA','SOMALI','SOUTH_ETHIOPIA','SOUTH_WEST_ETHIOPIA','TIGRAY'
  ) then raise exception 'PROVIDER_BASE_REGION_REQUIRED'; end if;

  if char_length(headline_value)>120 or char_length(about_value)>2000 or char_length(services_value)>1000
    or char_length(phone_value)>80 or char_length(whatsapp_value)>80
    or char_length(email_value)>254 or char_length(website_value)>500 then
    raise exception 'INVALID_PROVIDER_PROFILE_INPUT';
  end if;
  if website_value<>'' and website_value!~*'^https://[^[:space:]]+$' then raise exception 'INVALID_WEBSITE_URL'; end if;

  if page.organization_id is not null then
    select organization.city_place_ref into current_place_ref
    from public.organizations organization where organization.id=page.organization_id;
  else
    select provider.city_place_ref into current_place_ref
    from public.provider_profiles provider where provider.id=page.provider_profile_id;
  end if;

  if requested_place_ref is not null then
    select catalog.id,catalog.name,catalog.parent_name,catalog.country_name,
      catalog.latitude,catalog.longitude
      into place
    from public.place_catalog catalog where catalog.id=requested_place_ref;
    if not found then raise exception 'LOCALITY_REQUIRED'; end if;
  end if;

  if published_value and coalesce(requested_place_ref,current_place_ref) is null then raise exception 'BASE_LOCATION_REQUIRED'; end if;
  if published_value and region_code is null then raise exception 'PROVIDER_BASE_REGION_REQUIRED'; end if;

  update public.company_pages set
    headline=headline_value,about=about_value,services=services_value,base_region_code=region_code,
    contact_phone=phone_value,contact_whatsapp=whatsapp_value,contact_email=email_value,
    contact_website=website_value,show_contact_phone=show_phone,show_contact_whatsapp=show_whatsapp,
    show_contact_email=show_email,show_contact_website=show_website,published=published_value,updated_at=now()
  where id=page.id;

  if requested_place_ref is not null and page.organization_id is not null then
    update public.organizations set
      city=concat_ws(', ',place.name,
        case when place.parent_name is not null and lower(place.parent_name)<>lower(place.name) then place.parent_name end,
        coalesce(place.country_name,'Ethiopia')),
      city_place_ref=place.id,city_lat=place.latitude,city_lng=place.longitude
    where id=page.organization_id;
  elsif requested_place_ref is not null then
    update public.provider_profiles set
      city=concat_ws(', ',place.name,
        case when place.parent_name is not null and lower(place.parent_name)<>lower(place.name) then place.parent_name end,
        coalesce(place.country_name,'Ethiopia')),
      city_place_ref=place.id,city_lat=place.latitude,city_lng=place.longitude
    where id=page.provider_profile_id;
  end if;

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'COMPANY_PAGE_UPDATED','company_page',page.id,
    jsonb_build_object('basePlaceRef',coalesce(requested_place_ref,current_place_ref),'baseRegionCode',region_code,
      'published',published_value,'publicContacts',jsonb_build_object(
        'phone',show_phone,'whatsapp',show_whatsapp,'email',show_email,'website',show_website)),now());
  return page.id;
exception
  when invalid_text_representation then raise exception 'INVALID_PROVIDER_PROFILE_INPUT';
end;
$$;

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
    or file_size<1 or file_size>10485760 then raise exception 'PROFILE_IMAGE_TYPE_INVALID'; end if;

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

create or replace function public.remove_provider_profile_image(actor_user_id uuid)
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

  select * into page from public.company_pages candidate
  where candidate.organization_id=actor.organization_id
     or candidate.provider_profile_id=actor.provider_profile_id
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  prior_reference:=page.profile_image_path;
  update public.company_pages set profile_image_path=null,profile_image_mime=null,
    profile_image_updated_at=now(),updated_at=now() where id=page.id;
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'PROVIDER_PROFILE_IMAGE_REMOVED','company_page',page.id,
    '{}'::jsonb,now());
  return jsonb_build_object('page_id',page.id,'previous_reference',prior_reference);
end;
$$;

revoke all on function public.provider_profile_actor_scope(uuid) from public,anon,authenticated;
revoke all on function public.provider_profile_workspace(uuid) from public,anon,authenticated;
revoke all on function public.update_provider_profile_page(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_provider_profile_image(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.remove_provider_profile_image(uuid) from public,anon,authenticated;

grant execute on function public.provider_profile_actor_scope(uuid) to service_role;
grant execute on function public.provider_profile_workspace(uuid) to service_role;
grant execute on function public.update_provider_profile_page(uuid,jsonb) to service_role;
grant execute on function public.update_provider_profile_image(uuid,text,text,integer) to service_role;
grant execute on function public.remove_provider_profile_image(uuid) to service_role;
