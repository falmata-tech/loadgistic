-- FEAT-IAM/PRV-001: personal first name, explicit callback and own portrait.
-- Company information and authorized private full-name workflows are retained.
begin;
select pg_advisory_xact_lock(8030141);
set local timezone='UTC';
do $backup$
declare signature text;name text;backup_signature text;definition text;
begin
 foreach signature in array array[
 'public.update_own_account_details(uuid,jsonb)','public.current_user_projection()',
 'public.prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz)','public.complete_provider_signup(uuid,text)',
 'public.fleet_update_driver_contact(uuid,jsonb)','public.fleet_register_driver(uuid,uuid,jsonb)','public.fleet_accept_invitation(uuid,uuid)',
 'public.update_provider_profile_page(uuid,jsonb)','public.public_provider_page_details(uuid,uuid)','public.public_provider_driver_names(uuid[])',
 'public.public_capacity_page(jsonb,timestamptz,uuid,integer)','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)',
 'public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer)','public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)',
 'public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)','public.capacity_search_metadata(jsonb)',
 'public.public_featured_provider_candidates(text[])','public.tracking_public_truck_summary(uuid)',
 'public.provider_guest_tracking(uuid,text)','public.pending_provider_tracking_email_deliveries(integer)','public.finish_account_erasure(uuid,uuid)'
 ] loop
  name:=split_part(split_part(signature,'(',1),'.',2);backup_signature:=replace(signature,'public.'||name||'(','public.'||name||'_pre_identity141(');
  if to_regprocedure(backup_signature) is not null then raise exception 'PERSONAL_IDENTITY_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||name||'_pre_identity141(');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_signature);
  execute format('comment on function %s is %L',backup_signature,jsonb_build_object('migration',141,'original_signature',signature,'before_md5',md5(definition),
   'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure))::text);
 end loop;
end $backup$;

-- No historical row is parsed or rewritten. Explicit clearing is distinguishable
-- from an old client omitting the personal-public callback setting.
alter table public.profiles add column first_name text,add column last_name text,
 add column public_callback_phone text,add column public_callback_phone_configured boolean not null default false;
alter table public.provider_signup_intents add column first_name text,add column last_name text,
 add column public_callback_phone text,add column public_callback_phone_configured boolean not null default false;

create function public.normalize_personal_name(value text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(translate(coalesce(value,''),U&'\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
 repeat(' ',length(U&'\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))),'[[:space:]]+',' ','g'))
$$;
create function public.public_person_first_name(target_user_id uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(nullif(public.normalize_personal_name(p.first_name),''),nullif(split_part(public.normalize_personal_name(p.full_name),' ',1),''))
 from profiles p where p.id=target_user_id and p.active
$$;
create function public.public_person_callback_phone(target_user_id uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select case when p.public_callback_phone_configured then p.public_callback_phone else coalesce(
  (select nullif(trim(d.phone),'') from drivers d where d.user_id=p.id and d.active limit 1),
  (select nullif(trim(page.contact_phone),'') from provider_profiles provider join company_pages page on page.provider_profile_id=provider.id
   where provider.user_id=p.id and page.show_contact_phone limit 1)) end
 from profiles p where p.id=target_user_id and p.active and p.role='DRIVER'
$$;
create function public.public_person_portrait_url(target_user_id uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select '/api/public/driver-portraits/'||image.id from driver_portrait_uploads image
  where image.user_id=p.id and image.state='ACTIVE' and public.public_driver_portrait_file(image.id) is not null limit 1),
  case when p.driver_portrait_preset is not null then '/marketing/drivers/'||p.driver_portrait_preset end)
 from profiles p where p.id=target_user_id and p.active and p.role='DRIVER'
 and not exists(select 1 from provider_profiles provider where provider.user_id=p.id and(provider.content_hidden or provider.review_workspace))
 and not exists(select 1 from organization_members m join organizations o on o.id=m.organization_id where m.user_id=p.id and(o.content_hidden or o.review_workspace))
$$;
create function public.public_person_identities(requested_user_ids uuid[])
returns table(id uuid,first_name text,callback_phone text,portrait_url text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if requested_user_ids is null or cardinality(requested_user_ids)>100 or (cardinality(requested_user_ids)>0 and array_ndims(requested_user_ids)<>1)
 or array_position(requested_user_ids,null) is not null or (select count(distinct x) from unnest(requested_user_ids) x)<>cardinality(requested_user_ids)
 then raise exception 'INVALID_PUBLIC_PERSON_SCOPE';end if;
 return query select p.id,public.public_person_first_name(p.id),public.public_person_callback_phone(p.id),public.public_person_portrait_url(p.id)
 from profiles p where p.id=any(requested_user_ids) and p.active and p.role='DRIVER';
end $$;
revoke all on function public.normalize_personal_name(text),public.public_person_first_name(uuid),public.public_person_callback_phone(uuid),
 public.public_person_portrait_url(uuid),public.public_person_identities(uuid[]) from public,anon,authenticated;
grant execute on function public.normalize_personal_name(text),public.public_person_first_name(uuid),public.public_person_callback_phone(uuid),
 public.public_person_portrait_url(uuid),public.public_person_identities(uuid[]) to service_role;

create or replace function public.update_own_account_details(actor_user_id uuid,command jsonb) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor profiles%rowtype;name_value text;first_value text;last_value text;phone_value text;callback_value text;structured boolean;callback_changed boolean:=false;
begin
 perform public.require_content_policy(actor_user_id);
 perform 1 from drivers where user_id=actor_user_id for update;
 select * into actor from profiles where id=actor_user_id for update;
 if not found or not actor.active or actor.role not in ('TRANSPORTER','DRIVER','ADMIN') then raise exception 'FORBIDDEN';end if;
 if command is null or jsonb_typeof(command)<>'object' or jsonb_typeof(command->'phone') is distinct from 'string' then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
 structured:=command ? 'firstName';
 if structured then
  if command-array['firstName','lastName','phone','publicCallbackPhone']<>'{}'::jsonb or jsonb_typeof(command->'firstName') is distinct from 'string'
   or jsonb_typeof(command->'lastName') is distinct from 'string' then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
  first_value:=public.normalize_personal_name(command->>'firstName');last_value:=public.normalize_personal_name(command->>'lastName');
  if char_length(first_value) not between 1 and 100 or char_length(last_value)>100 or char_length(concat_ws(' ',first_value,nullif(last_value,'')))>100
   or first_value ~ '[[:cntrl:]]' or last_value ~ '[[:cntrl:]]' then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
  -- A historical unparsed suffix is preserved when the new empty input cannot
  -- distinguish it from an intentionally absent Last / father name.
  name_value:=case when last_value='' and actor.last_name is null then actor.full_name else concat_ws(' ',first_value,nullif(last_value,'')) end;
 else
  if command-array['name','phone']<>'{}'::jsonb or jsonb_typeof(command->'name') is distinct from 'string' then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
  name_value:=btrim(command->>'name',E' \t\n\r\f'||chr(11));
  if char_length(name_value) not between 2 and 100 or name_value ~ '[[:cntrl:]]' then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
 end if;
 phone_value:=trim(command->>'phone');
 if char_length(phone_value)>32 or (phone_value<>'' and(phone_value!~'^[0-9+() .-]+$' or char_length(regexp_replace(phone_value,'[^0-9]','','g'))<7)) then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
 if command ? 'publicCallbackPhone' then
  if jsonb_typeof(command->'publicCallbackPhone') is distinct from 'string' then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
  callback_value:=trim(command->>'publicCallbackPhone');
  if char_length(callback_value)>32 or(callback_value<>'' and(callback_value!~'^[0-9+() .-]+$' or char_length(regexp_replace(callback_value,'[^0-9]','','g'))<7)) then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
  if actor.role<>'DRIVER' or not(exists(select 1 from provider_profiles p where p.user_id=actor.id)
   or exists(select 1 from drivers d join organization_members m on m.user_id=d.user_id and m.organization_id=d.organization_id where d.user_id=actor.id and d.active)) then raise exception 'FORBIDDEN';end if;
  callback_changed:=true;
 end if;
 update profiles set full_name=name_value,phone=nullif(phone_value,''),
  first_name=case when structured then first_value else first_name end,
  last_name=case when structured and(last_value<>'' or actor.last_name is not null) then last_value else last_name end,
  public_callback_phone=case when callback_changed then nullif(callback_value,'') else public_callback_phone end,
  public_callback_phone_configured=case when callback_changed then true else public_callback_phone_configured end where id=actor.id;
 update drivers set name=name_value,phone=case when callback_changed then nullif(callback_value,'') else phone end where user_id=actor.id and active;
 if callback_changed then
  update company_pages page set contact_phone=nullif(callback_value,''),show_contact_phone=callback_value<>'',updated_at=now()
  where page.provider_profile_id in(select p.id from provider_profiles p where p.user_id=actor.id);
 end if;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details) values(actor.id,'ACCOUNT_DETAILS_UPDATED','profile',actor.id,'{}');
 return true;
end $$;

-- Preserve caller-bound identity, eligibility, fleet lock/authority and the
-- installed profile/Services guards by changing exact reviewed anchors only.
do $private_contracts$
declare signature text;definition text;old_text text;new_text text;
begin
 for signature,old_text,new_text in values
 ('public.current_user_projection()',$old$'name',profile.full_name,$old$,$new$'name',profile.full_name,
    'firstName',public.public_person_first_name(profile.id),'lastName',profile.last_name,
    'publicCallbackPhone',public.public_person_callback_phone(profile.id),$new$),
 ('public.complete_provider_signup(uuid,text)',$old$email=lower(trim(auth_user.email)),full_name=intent.full_name,phone=intent.phone,$old$,$new$email=lower(trim(auth_user.email)),full_name=intent.full_name,phone=intent.phone,
    first_name=intent.first_name,last_name=intent.last_name,public_callback_phone=intent.public_callback_phone,public_callback_phone_configured=intent.public_callback_phone_configured,$new$),
 ('public.fleet_update_driver_contact(uuid,jsonb)',$old$update profiles set full_name=name_value where id=driver_id;$old$,$new$update profiles set full_name=name_value,public_callback_phone=phone_value,public_callback_phone_configured=true where id=driver_id;$new$),
 ('public.fleet_register_driver(uuid,uuid,jsonb)',$old$update profiles set active=true,full_name=name_value where id=target_user_id;$old$,$new$update profiles set active=true,full_name=name_value,public_callback_phone=phone_value,public_callback_phone_configured=true where id=target_user_id;$new$),
 ('public.fleet_accept_invitation(uuid,uuid)',$old$update profiles set active=true,full_name=invitation.driver_name,phone=invitation.phone where id=actor_user_id;$old$,$new$update profiles set active=true,full_name=invitation.driver_name,phone=invitation.phone,public_callback_phone=invitation.phone,public_callback_phone_configured=true where id=actor_user_id;$new$),
 ('public.prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz)',$old$if length(clean_name)<2 or length(clean_name)>120$old$,$new$if length(clean_name)<1 or length(clean_name)>120$new$),
 ('public.prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz)',$old$if length(clean_business)<2 or length(clean_business)>140$old$,$new$if length(clean_business)<(case when clean_type='TRANSPORT_COMPANY' then 2 else 1 end) or length(clean_business)>140$new$),
 ('public.prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz)',$old$if length(clean_phone)<7 or length(clean_phone)>30 or clean_phone !~ '^[0-9+() .-]+$'$old$,$new$if length(clean_phone)<7 or length(clean_phone)>30 or clean_phone !~ '^[0-9+() .-]+$' or char_length(regexp_replace(clean_phone,'[^0-9]','','g'))<7$new$),
 ('public.update_provider_profile_page(uuid,jsonb)',$old$  insert into public.audit_logs($old$,$new$  if page.provider_profile_id is not null and(command ? 'contact_phone' or command ? 'show_contact_phone') then
    update profiles set public_callback_phone=case when show_phone then nullif(phone_value,'') end,public_callback_phone_configured=true
    where id=(select p.user_id from provider_profiles p where p.id=page.provider_profile_id);
  end if;
  insert into public.audit_logs($new$)
 loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PERSONAL_PRIVATE_ANCHOR_DRIFT: %',signature;end if;
  execute replace(definition,old_text,new_text);
 end loop;
 signature:='public.update_provider_profile_page(uuid,jsonb)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$  if not found then raise exception 'NOT_FOUND'; end if;

  region_code:=$old$;
 new_text:=$new$  if not found then raise exception 'NOT_FOUND'; end if;
  if page.provider_profile_id is not null then
    if not(command ? 'headline') then headline_value:=coalesce(page.headline,'');end if;
    if not(command ? 'about') then about_value:=coalesce(page.about,'');end if;
    if not(command ? 'contact_phone') then phone_value:=coalesce(page.contact_phone,'');end if;
    if not(command ? 'contact_whatsapp') then whatsapp_value:=coalesce(page.contact_whatsapp,'');end if;
    if not(command ? 'contact_email') then email_value:=coalesce(page.contact_email,'');end if;
    if not(command ? 'contact_website') then website_value:=coalesce(page.contact_website,'');end if;
    if not(command ? 'show_contact_phone') then show_phone:=page.show_contact_phone;end if;
    if not(command ? 'show_contact_whatsapp') then show_whatsapp:=page.show_contact_whatsapp;end if;
    if not(command ? 'show_contact_email') then show_email:=page.show_contact_email;end if;
    if not(command ? 'show_contact_website') then show_website:=page.show_contact_website;end if;
  end if;

  region_code:=$new$;
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PERSONAL_PARTIAL_PROFILE_ANCHOR_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 for old_text,new_text in values
  ($old$headline=headline_value$old$,$new$headline=case when page.provider_profile_id is not null and not(command ? 'headline') then page.headline else headline_value end$new$),
  ($old$about=about_value$old$,$new$about=case when page.provider_profile_id is not null and not(command ? 'about') then page.about else about_value end$new$),
  ($old$contact_phone=phone_value$old$,$new$contact_phone=case when page.provider_profile_id is not null and not(command ? 'contact_phone') then page.contact_phone else phone_value end$new$),
  ($old$contact_whatsapp=whatsapp_value$old$,$new$contact_whatsapp=case when page.provider_profile_id is not null and not(command ? 'contact_whatsapp') then page.contact_whatsapp else whatsapp_value end$new$),
  ($old$contact_email=email_value$old$,$new$contact_email=case when page.provider_profile_id is not null and not(command ? 'contact_email') then page.contact_email else email_value end$new$),
  ($old$contact_website=website_value$old$,$new$contact_website=case when page.provider_profile_id is not null and not(command ? 'contact_website') then page.contact_website else website_value end$new$),
  ($old$if website_value<>'' and website_value!~*$old$,$new$if (page.organization_id is not null or command ? 'contact_website') and website_value<>'' and website_value!~*$new$),
  ($old$char_length(headline_value)>120$old$,$new$(page.organization_id is not null or command ? 'headline') and char_length(headline_value)>120$new$),
  ($old$char_length(about_value)>2000$old$,$new$(page.organization_id is not null or command ? 'about') and char_length(about_value)>2000$new$),
  ($old$char_length(phone_value)>80$old$,$new$(page.organization_id is not null or command ? 'contact_phone') and char_length(phone_value)>80$new$),
  ($old$char_length(whatsapp_value)>80$old$,$new$(page.organization_id is not null or command ? 'contact_whatsapp') and char_length(whatsapp_value)>80$new$),
  ($old$char_length(email_value)>254$old$,$new$(page.organization_id is not null or command ? 'contact_email') and char_length(email_value)>254$new$),
  ($old$char_length(website_value)>500$old$,$new$(page.organization_id is not null or command ? 'contact_website') and char_length(website_value)>500$new$)
 loop
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PERSONAL_PARTIAL_VALUE_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $private_contracts$;

create function public.prepare_provider_signup_identity(requested_token_digest text,command jsonb,requested_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare first_value text;last_value text;name_value text;business_value text;application_type text;intent_id uuid;callback_value text;
begin
 if command is null or jsonb_typeof(command)<>'object' or command-array['firstName','lastName','businessName','phone','applicationType','notes','publicCallbackPhone']<>'{}'::jsonb
 or jsonb_typeof(command->'firstName') is distinct from 'string' or jsonb_typeof(command->'lastName') is distinct from 'string'
 then raise exception 'INVALID_SIGNUP_NAME';end if;
 first_value:=public.normalize_personal_name(command->>'firstName');last_value:=public.normalize_personal_name(command->>'lastName');name_value:=concat_ws(' ',first_value,nullif(last_value,''));
 if char_length(first_value) not between 1 and 100 or char_length(last_value)>100 or char_length(name_value)>100 or name_value ~ '[[:cntrl:]]' then raise exception 'INVALID_SIGNUP_NAME';end if;
 application_type:=upper(trim(command->>'applicationType'));
 business_value:=case when application_type='TRANSPORT_COMPANY' then command->>'businessName' else coalesce(nullif(trim(command->>'businessName'),''),first_value) end;
 intent_id:=public.prepare_provider_signup_intent(requested_token_digest,name_value,business_value,command->>'phone',application_type,command->>'notes',requested_expires_at);
 if command ? 'publicCallbackPhone' then
  if application_type='TRANSPORT_COMPANY' then raise exception 'INVALID_SIGNUP_PHONE';end if;
  callback_value:=trim(command->>'publicCallbackPhone');
  if jsonb_typeof(command->'publicCallbackPhone') is distinct from 'string' or char_length(callback_value)>32 or(callback_value<>'' and(callback_value!~'^[0-9+() .-]+$' or char_length(regexp_replace(callback_value,'[^0-9]','','g'))<7)) then raise exception 'INVALID_SIGNUP_PHONE';end if;
 end if;
 update provider_signup_intents set first_name=first_value,last_name=last_value,public_callback_phone=nullif(callback_value,''),public_callback_phone_configured=command ? 'publicCallbackPhone' where id=intent_id;
 return intent_id;
end $$;
revoke all on function public.prepare_provider_signup_identity(text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.prepare_provider_signup_identity(text,jsonb,timestamptz) to service_role;

do $public_rows$
declare signature text;definition text;old_text text;new_text text;is_public boolean;
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamptz,uuid,integer)','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)',
 'public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer)','public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)',
 'public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);is_public:=signature like '%public_capacity_page%' or signature like '%capacity_search_public_rows%';
  for old_text,new_text in values
   ($old$coalesce(organization.name,provider.business_name)$old$,$new$coalesce(organization.name,public.public_person_first_name(provider.user_id))$new$),
   (case when is_public then $old$'assigned_driver_first_name',nullif(split_part(trim(coalesce(assigned_driver_name,'')),' ',1),''),$old$
     else $old$'assigned_driver_first_name',nullif(split_part(trim(coalesce(driver.full_name,provider_user.full_name,'')),' ',1),''),$old$ end,
    case when is_public then $new$'assigned_driver_first_name',public.public_person_first_name(public.capacity_active_driver_id(vehicle_id)),
  'assigned_driver_portrait_url',public.public_person_portrait_url(public.capacity_active_driver_id(vehicle_id)),$new$
     else $new$'assigned_driver_first_name',public.public_person_first_name(public.capacity_active_driver_id(capacity.vehicle_id)),
    'assigned_driver_portrait_url',public.public_person_portrait_url(public.capacity_active_driver_id(capacity.vehicle_id)),$new$ end),
   (case when is_public then $old$coalesce(fleet_driver.phone,case when candidate.show_contact_phone then candidate.page_contact_phone end) as assigned_driver_phone$old$
     else $old$'assigned_driver_phone',coalesce(fleet_driver.phone,case when page.show_contact_phone then page.contact_phone end)$old$ end,
    case when is_public then $new$public.public_person_callback_phone(public.capacity_active_driver_id(candidate.vehicle_id)) as assigned_driver_phone$new$
     else $new$'assigned_driver_phone',public.public_person_callback_phone(public.capacity_active_driver_id(capacity.vehicle_id))$new$ end)
  loop
   if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PERSONAL_PUBLIC_ROW_DRIFT: %',signature;end if;
   definition:=replace(definition,old_text,new_text);
  end loop;
  -- Independent profiles have only their personal callback; company business
  -- contact methods retain their current individual visibility controls.
  for old_text,new_text in values
   (case when is_public then $old$case when candidate.show_contact_phone then candidate.page_contact_phone end as contact_phone$old$ else $old$'contact_phone',case when page.show_contact_phone then page.contact_phone end$old$ end,
    case when is_public then $new$case when candidate.provider_organization_id is not null then case when candidate.show_contact_phone then candidate.page_contact_phone end else public.public_person_callback_phone(candidate.profile_user_id) end as contact_phone$new$ else $new$'contact_phone',case when capacity.provider_organization_id is not null then case when page.show_contact_phone then page.contact_phone end else public.public_person_callback_phone(provider.user_id) end$new$ end),
   (case when is_public then $old$case when candidate.show_contact_whatsapp then candidate.page_contact_whatsapp end$old$ else $old$case when page.show_contact_whatsapp then page.contact_whatsapp end$old$ end,
    case when is_public then $new$case when candidate.provider_organization_id is not null and candidate.show_contact_whatsapp then candidate.page_contact_whatsapp end$new$ else $new$case when capacity.provider_organization_id is not null and page.show_contact_whatsapp then page.contact_whatsapp end$new$ end),
   (case when is_public then $old$case when candidate.show_contact_email then candidate.page_contact_email end$old$ else $old$case when page.show_contact_email then page.contact_email end$old$ end,
    case when is_public then $new$case when candidate.provider_organization_id is not null and candidate.show_contact_email then candidate.page_contact_email end$new$ else $new$case when capacity.provider_organization_id is not null and page.show_contact_email then page.contact_email end$new$ end),
   (case when is_public then $old$case when candidate.show_contact_website then candidate.page_contact_website end$old$ else $old$case when page.show_contact_website then page.contact_website end$old$ end,
    case when is_public then $new$case when candidate.provider_organization_id is not null and candidate.show_contact_website then candidate.page_contact_website end$new$ else $new$case when capacity.provider_organization_id is not null and page.show_contact_website then page.contact_website end$new$ end)
  loop
   if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PERSONAL_CONTACT_ROW_DRIFT: %',signature;end if;
   definition:=replace(definition,old_text,new_text);
  end loop;
  execute definition;
 end loop;
end $public_rows$;

do $other_public$
declare signature text;definition text;old_text text;new_text text;
begin
 for signature,old_text,new_text in values
 ('public.public_provider_driver_names(uuid[])',$old$nullif(split_part(trim(regexp_replace(p.full_name,'[[:space:]]+',' ','g')),' ',1),'')$old$,$new$public.public_person_first_name(p.id)$new$),
 ('public.capacity_search_metadata(jsonb)',$old$select nullif(split_part(trim(regexp_replace(p.full_name,'[[:space:]]+',' ','g')),' ',1),'') into driver_name from profiles p where p.id=driver and p.active;$old$,$new$driver_name:=public.public_person_first_name(driver);$new$),
 ('public.capacity_search_metadata(jsonb)',$old$coalesce(o.city,p.city),c.headline,c.about into city,heading,about$old$,$new$case when org is not null then o.city end,case when org is not null then c.headline end,case when org is not null then c.about end into city,heading,about$new$),
 ('public.public_featured_provider_candidates(text[])',$old$coalesce(organization.name,profile.business_name)$old$,$new$coalesce(organization.name,public.public_person_first_name(profile.user_id))$new$),
 ('public.public_featured_provider_candidates(text[])',$old$page.headline,page.about,page.operating_regions$old$,$new$case when page.organization_id is not null then page.headline end as headline,case when page.organization_id is not null then page.about end as about,case when page.organization_id is not null then page.operating_regions end as operating_regions$new$),
 ('public.public_featured_provider_candidates(text[])',$old$((page.show_contact_phone and nullif(trim(page.contact_phone),'') is not null)
      or (page.show_contact_whatsapp and nullif(trim(page.contact_whatsapp),'') is not null)
      or (page.show_contact_email and nullif(trim(page.contact_email),'') is not null)
      or (page.show_contact_website and nullif(trim(page.contact_website),'') is not null)) as has_public_contact$old$,$new$(case when page.provider_profile_id is not null then public.public_person_callback_phone(profile.user_id) is not null else ((page.show_contact_phone and nullif(trim(page.contact_phone),'') is not null)
      or (page.show_contact_whatsapp and nullif(trim(page.contact_whatsapp),'') is not null)
      or (page.show_contact_email and nullif(trim(page.contact_email),'') is not null)
      or (page.show_contact_website and nullif(trim(page.contact_website),'') is not null)) end) as has_public_contact$new$),
 ('public.public_featured_provider_candidates(text[])',$old$'base_place',base_place_label,'base_region_code',base_region_code$old$,$new$'base_place',case when provider_organization_id is not null then base_place_label end,'base_region_code',case when provider_organization_id is not null then base_region_code end$new$),
 ('public.tracking_public_truck_summary(uuid)',$old$coalesce(o.name,p.business_name)$old$,$new$coalesce(o.name,public.public_person_first_name(p.user_id))$new$),
 ('public.tracking_public_truck_summary(uuid)',$old$coalesce(fleet_driver.phone,case when page.show_contact_phone then page.contact_phone end)$old$,$new$public.public_person_callback_phone(s.assigned_driver_user_id)$new$),
 ('public.tracking_public_truck_summary(uuid)',$old$'contactPhone',case when page.show_contact_phone then page.contact_phone end)$old$,$new$'contactPhone',case when s.provider_organization_id is not null then case when page.show_contact_phone then page.contact_phone end else public.public_person_callback_phone(p.user_id) end,
  'driverPortrait',case when page.id is not null then public.public_person_portrait_url(s.assigned_driver_user_id) end)$new$),
 ('public.pending_provider_tracking_email_deliveries(integer)',$old$coalesce(organization.name,provider.business_name)$old$,$new$coalesce(organization.name,public.public_person_first_name(provider.user_id))$new$),
 ('public.finish_account_erasure(uuid,uuid)',$old$phone=null,driver_portrait_preset=null where id=subject.id;$old$,$new$phone=null,driver_portrait_preset=null,first_name=null,last_name=null,public_callback_phone=null,public_callback_phone_configured=false where id=subject.id;$new$),
 ('public.provider_guest_tracking(uuid,text)',$old$return result||jsonb_build_object('route',public.tracking_route_projection(target_shipment_id),$old$,$new$return result||jsonb_build_object('provider_name',(select coalesce(o.name,public.public_person_first_name(p.user_id)) from provider_shipments s left join organizations o on o.id=s.provider_organization_id left join provider_profiles p on p.id=s.provider_profile_id where s.id=target_shipment_id),
  'route',public.tracking_route_projection(target_shipment_id),$new$)
 loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PERSONAL_PUBLIC_ANCHOR_DRIFT: %',signature;end if;
  execute replace(definition,old_text,new_text);
 end loop;
 signature:='public.public_provider_page_details(uuid,uuid)';definition:=pg_get_functiondef(signature::regprocedure);
 for old_text,new_text in values
  ($old$return (select jsonb_build_object($old$,$new$return (select jsonb_build_object(
  'public_name',case when p.organization_id is not null then (select o.name from organizations o where o.id=p.organization_id) else public.public_person_first_name((select owner.user_id from provider_profiles owner where owner.id=p.provider_profile_id)) end,$new$),
  ($old$'headline',p.headline,'about',p.about,$old$,$new$'headline',case when p.organization_id is not null then p.headline end,'about',case when p.organization_id is not null then p.about end,$new$),
  ($old$'contact_phone',case when p.show_contact_phone then p.contact_phone end$old$,$new$'contact_phone',case when p.organization_id is not null then case when p.show_contact_phone then p.contact_phone end else public.public_person_callback_phone((select owner.user_id from provider_profiles owner where owner.id=p.provider_profile_id)) end$new$),
  ($old$case when p.show_contact_email then p.contact_email end$old$,$new$case when p.organization_id is not null and p.show_contact_email then p.contact_email end$new$),
  ($old$case when p.show_contact_whatsapp then p.contact_whatsapp end$old$,$new$case when p.organization_id is not null and p.show_contact_whatsapp then p.contact_whatsapp end$new$),
  ($old$case when p.show_contact_website then p.contact_website end$old$,$new$case when p.organization_id is not null and p.show_contact_website then p.contact_website end$new$),
  ($old$'youtube_video_id',p.youtube_video_id$old$,$new$'youtube_video_id',case when p.organization_id is not null then p.youtube_video_id end$new$)
 loop
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PERSONAL_PROFILE_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $other_public$;

-- Exact owner-only backups also bind rollback to unchanged identity/callback
-- rows. After use, preserve the privacy correction and perform forward repair;
-- an old public-serving adapter is not an authorized privacy rollback.
do $receipts$
declare backup record;signature text;receipt jsonb;baseline_fingerprint text;
begin
 select encode(extensions.digest(jsonb_build_object(
  'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from profiles p),
  'intents',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from provider_signup_intents p),
  'drivers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from drivers p),
  'pages',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from company_pages p)
 )::text,'sha256'),'hex') into baseline_fingerprint;
 for backup in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and right(p.proname,16)='_pre_identity141' loop
  receipt:=obj_description(backup.oid,'pg_proc')::jsonb;signature:=receipt->>'original_signature';
  if receipt->>'migration' is distinct from '141' then raise exception 'PERSONAL_RECEIPT_DRIFT';end if;
  receipt:=receipt||jsonb_build_object('after_md5',md5(pg_get_functiondef(signature::regprocedure)),'baseline_identity_sha256',baseline_fingerprint);
  execute format('comment on function %s is %L',backup.oid::regprocedure,receipt::text);
 end loop;
 foreach signature in array array['public.normalize_personal_name(text)','public.public_person_first_name(uuid)','public.public_person_callback_phone(uuid)',
 'public.public_person_portrait_url(uuid)','public.public_person_identities(uuid[])','public.prepare_provider_signup_identity(text,jsonb,timestamptz)'] loop
  execute format('comment on function %s is %L',signature,jsonb_build_object('migration',141,'after_md5',md5(pg_get_functiondef(signature::regprocedure)),
   'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure))::text);
 end loop;
end $receipts$;
notify pgrst,'reload schema';
commit;
