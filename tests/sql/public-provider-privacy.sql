begin;
do $test$
declare actor uuid:=gen_random_uuid(); provider uuid:=gen_random_uuid(); result jsonb; name_value text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(actor,'public-privacy-'||actor||'@example.test',now(),'{}');
 update profiles set role='DRIVER',active=true,full_name='PublicFirst PrivateSurname' where id=actor;
 insert into provider_profiles(id,user_id,business_name,handle,public_visibility)
 values(provider,actor,'Historical Private Name','public-privacy-'||provider,'PUBLIC');
 insert into company_pages(provider_profile_id) values(provider);
 update company_pages set published=true,contact_phone='+251900000001',contact_email='hidden-contact@example.invalid',
  contact_whatsapp='+251900000002',contact_website='https://hidden-site.invalid',show_contact_phone=false,show_contact_email=false,
  show_contact_whatsapp=false,show_contact_website=false,profile_image_path='private-image-object' where provider_profile_id=provider;
 result:=public_provider_page_details(null,provider);
 if result is null or result->'contact_phone'<>'null'::jsonb or result->'contact_email'<>'null'::jsonb
  or result->'contact_whatsapp'<>'null'::jsonb or result->'contact_website'<>'null'::jsonb
  or result ? 'profile_image_path' or result->>'has_profile_image'<>'true'
  or result::text like '%private-image-object%' or result::text like '%hidden-contact%' then raise exception 'PRIVATE_METADATA_RETURNED';end if;
 update company_pages set show_contact_phone=true,show_contact_email=true,show_contact_whatsapp=true,show_contact_website=true where provider_profile_id=provider;
 result:=public_provider_page_details(null,provider);
 if result->>'contact_phone'<>'+251900000001' or result->>'contact_email' is not null
  or result->>'contact_whatsapp' is not null or result->>'contact_website' is not null then raise exception 'PERSONAL_PUBLIC_CONTACT_ALLOWLIST_WRONG';end if;
 update company_pages set published=false where provider_profile_id=provider;
 if public_provider_page_details(null,provider) is not null then raise exception 'UNPUBLISHED_METADATA';end if;
 begin perform public_provider_page_details(null,null);raise exception 'MISSING_SCOPE_ACCEPTED';exception when others then if sqlerrm<>'INVALID_PROVIDER_SCOPE' then raise;end if;end;
 begin perform public_provider_page_details(gen_random_uuid(),provider);raise exception 'DOUBLE_SCOPE_ACCEPTED';exception when others then if sqlerrm<>'INVALID_PROVIDER_SCOPE' then raise;end if;end;
 update profiles set full_name=E' \t PublicFirst\nPRIVATE_SURNAME' where id=actor;
 select first_name into strict name_value from public_provider_driver_names(array[actor]);
 if name_value<>'PublicFirst' then raise exception 'PRIVATE_SURNAME_RETURNED';end if;
 update profiles set active=false where id=actor;
 if exists(select 1 from public_provider_driver_names(array[actor])) then raise exception 'INACTIVE_DRIVER_NAME';end if;
 begin perform public_provider_driver_names(array_fill(actor,array[14]));raise exception 'UNBOUNDED_DRIVER_SCOPE';exception when others then if sqlerrm<>'INVALID_DRIVER_SCOPE' then raise;end if;end;
 if has_function_privilege('anon','public.public_provider_page_details(uuid,uuid)','execute')
  or has_function_privilege('authenticated','public.public_provider_driver_names(uuid[])','execute') then raise exception 'BROWSER_METADATA_RPC';end if;
 raise notice 'Hidden contacts, private paths/surnames, publication, bounded names and service-only scope passed';
end $test$;
rollback;
