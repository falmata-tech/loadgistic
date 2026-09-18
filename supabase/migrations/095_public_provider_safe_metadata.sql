-- FEAT-PRV-001 / F19: never deliver hidden metadata to a public render, including
-- development serialization of intermediate server promises.
create function public.public_provider_page_details(
 requested_organization_id uuid default null, requested_provider_profile_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if (requested_organization_id is null)=(requested_provider_profile_id is null) then raise exception 'INVALID_PROVIDER_SCOPE';end if;
 if requested_organization_id is not null and not exists(select 1 from organizations where id=requested_organization_id and type='TRANSPORT_COMPANY') then return null;end if;
 return (select jsonb_build_object(
  'headline',p.headline,'about',p.about,'services',p.services,'theme_primary',p.theme_primary,'theme_accent',p.theme_accent,
  'contact_phone',case when p.show_contact_phone then p.contact_phone end,
  'contact_email',case when p.show_contact_email then p.contact_email end,
  'contact_whatsapp',case when p.show_contact_whatsapp then p.contact_whatsapp end,
  'contact_website',case when p.show_contact_website then p.contact_website end,
  'show_contact_phone',p.show_contact_phone,'show_contact_email',p.show_contact_email,
  'show_contact_whatsapp',p.show_contact_whatsapp,'show_contact_website',p.show_contact_website,
  'youtube_video_id',p.youtube_video_id,'has_profile_image',p.profile_image_path is not null,
  'profile_image_updated_at',p.profile_image_updated_at,'profile_image_preset',p.profile_image_preset,'published',true
 ) from company_pages p where p.published and (p.organization_id=requested_organization_id or p.provider_profile_id=requested_provider_profile_id));
end$$;
revoke all on function public.public_provider_page_details(uuid,uuid) from public,anon,authenticated;
grant execute on function public.public_provider_page_details(uuid,uuid) to service_role;

create function public.public_provider_driver_names(requested_user_ids uuid[])
returns table(id uuid,first_name text) language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if requested_user_ids is null or cardinality(requested_user_ids)>13 then raise exception 'INVALID_DRIVER_SCOPE';end if;
 return query select p.id,nullif(split_part(trim(regexp_replace(p.full_name,'[[:space:]]+',' ','g')),' ',1),'') from profiles p
  where p.id=any(requested_user_ids) and p.active and p.role='DRIVER';
end$$;
revoke all on function public.public_provider_driver_names(uuid[]) from public,anon,authenticated;
grant execute on function public.public_provider_driver_names(uuid[]) to service_role;
