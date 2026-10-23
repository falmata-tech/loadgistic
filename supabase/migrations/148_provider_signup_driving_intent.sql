-- FEAT-APP/IAM/FLT/PRV-001 / ADR-079: presentation and driving are independent.
-- Depends on145 owner scopes. Existing Auth/provider/organization IDs stay intact.
begin;
select pg_advisory_xact_lock(8030148);
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.provider_signup_intents add column drives_truck boolean;

do $backup$
declare signature text;name text;backup_signature text;definition text;
begin
 foreach signature in array array[
  'public.prepare_provider_signup_identity(text,jsonb,timestamptz)',
  'public.complete_provider_signup(uuid,text)',
  'public.public_person_callback_phone(uuid)','public.public_person_portrait_url(uuid)',
  'public.public_person_identities(uuid[])','public.driver_portrait_workspace(uuid)',
  'public.reserve_driver_portrait(uuid,text,integer)','public.activate_driver_portrait(uuid,uuid,boolean)',
  'public.remove_driver_portrait(uuid)','public.public_driver_portrait_file(uuid)',
  'public.update_own_account_details(uuid,jsonb)','public.tracking_public_truck_summary(uuid)'
 ] loop
  name:=split_part(split_part(signature,'(',1),'.',2);
  backup_signature:=replace(signature,'public.'||name||'(','public.'||name||'_pre_provider148(');
  if to_regprocedure(backup_signature) is not null then raise exception 'PROVIDER_SIGNUP_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||name||'_pre_provider148(');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_signature);
  execute format('comment on function %s is %L',backup_signature,jsonb_build_object('migration',148,'original_signature',signature,
   'before_md5',md5(definition),'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),
   'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure))::text);
 end loop;
end $backup$;

create function public.provider_owner_driver_enabled(target_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from profiles p where p.id=target_user_id and p.active and p.drives_truck
  and coalesce((public.provider_account_capabilities(p.id)->>'owns_provider_account')::boolean,false))
$$;

create function public.set_provider_driving_mode(actor_user_id uuid,requested_drives_truck boolean) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor profiles%rowtype;
begin
 perform public.require_content_policy(actor_user_id);
 select * into actor from profiles where id=actor_user_id for update;
 if not found or not actor.active or not exists(select 1 from public.fleet_provider_owner_scope(actor_user_id)) then raise exception 'FORBIDDEN';end if;
 if requested_drives_truck is null then raise exception 'INVALID_DRIVING_MODE';end if;
 if requested_drives_truck=false and exists(select 1 from driver_vehicle_assignments a where a.driver_user_id=actor.id and a.active)
 then raise exception 'DRIVER_ASSIGNED';end if;
 if actor.drives_truck is not distinct from requested_drives_truck then return true;end if;
 update profiles set drives_truck=requested_drives_truck where id=actor.id;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor.id,'PROVIDER_DRIVING_MODE_UPDATED','profile',actor.id,jsonb_build_object('drivesTruck',requested_drives_truck));
 return true;
end $$;
revoke all on function public.provider_owner_driver_enabled(uuid),public.set_provider_driving_mode(uuid,boolean) from public,anon,authenticated;
grant execute on function public.provider_owner_driver_enabled(uuid),public.set_provider_driving_mode(uuid,boolean) to service_role;

do $signup$
declare signature text;definition text;old_text text;new_text text;
begin
 signature:='public.prepare_provider_signup_identity(text,jsonb,timestamptz)';definition:=pg_get_functiondef(signature::regprocedure);
 for old_text,new_text in values
  ($old$'notes','publicCallbackPhone']$old$,$new$'notes','publicCallbackPhone','drivesTruck']$new$),
  ($old$ first_value:=public.normalize_personal_name(command->>'firstName');$old$,$new$ if command ? 'drivesTruck' and jsonb_typeof(command->'drivesTruck') is distinct from 'boolean' then raise exception 'INVALID_DRIVING_MODE';end if;
 first_value:=public.normalize_personal_name(command->>'firstName');$new$),
  ($old$update provider_signup_intents set first_name=first_value$old$,$new$update provider_signup_intents set drives_truck=case when command ? 'drivesTruck' then (command->>'drivesTruck')::boolean else null end,first_name=first_value$new$)
 loop
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_SIGNUP_INTENT_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
 signature:='public.complete_provider_signup(uuid,text)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$role=target_role,active=true$old$;
 new_text:=$new$role=target_role,active=true,drives_truck=coalesce(intent.drives_truck,target_role='DRIVER')$new$;
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_SIGNUP_COMPLETION_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $signup$;

-- Preserve existing consent, moderation, review-workspace and file checks while
-- extending only actual driver identity to a provider owner who drives.
do $driver_identity$
declare signature text;definition text;old_text text;new_text text;
begin
 for signature,old_text,new_text in values
  ('public.public_person_callback_phone(uuid)',$old$p.role='DRIVER'$old$,$new$(p.role='DRIVER' or public.provider_owner_driver_enabled(p.id))$new$),
  ('public.public_person_portrait_url(uuid)',$old$p.role='DRIVER'$old$,$new$(p.role='DRIVER' or public.provider_owner_driver_enabled(p.id))$new$),
  ('public.public_person_identities(uuid[])',$old$p.role='DRIVER'$old$,$new$(p.role='DRIVER' or public.provider_owner_driver_enabled(p.id))$new$),
  ('public.driver_portrait_workspace(uuid)',$old$role='DRIVER'$old$,$new$(role='DRIVER' or public.provider_owner_driver_enabled(id))$new$),
  ('public.reserve_driver_portrait(uuid,text,integer)',$old$role='DRIVER'$old$,$new$(role='DRIVER' or public.provider_owner_driver_enabled(id))$new$),
  ('public.activate_driver_portrait(uuid,uuid,boolean)',$old$role='DRIVER'$old$,$new$(role='DRIVER' or public.provider_owner_driver_enabled(id))$new$),
  ('public.remove_driver_portrait(uuid)',$old$role='DRIVER'$old$,$new$(role='DRIVER' or public.provider_owner_driver_enabled(id))$new$),
  ('public.public_driver_portrait_file(uuid)',$old$actor.role='DRIVER'$old$,$new$(actor.role='DRIVER' or public.provider_owner_driver_enabled(actor.id))$new$)
 loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_DRIVER_IDENTITY_DRIFT: %',signature;end if;
  execute replace(definition,old_text,new_text);
 end loop;
 signature:='public.update_own_account_details(uuid,jsonb)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$if actor.role<>'DRIVER' or not(exists(select 1 from provider_profiles p where p.user_id=actor.id)
   or exists(select 1 from drivers d join organization_members m on m.user_id=d.user_id and m.organization_id=d.organization_id where d.user_id=actor.id and d.active)) then raise exception 'FORBIDDEN';end if;$old$;
 new_text:=$new$if not(public.provider_owner_driver_enabled(actor.id) or actor.role='DRIVER' and exists(select 1 from public.provider_capacity_actor_scope(actor.id))) then raise exception 'FORBIDDEN';end if;$new$;
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_PUBLIC_CALLBACK_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $driver_identity$;

-- The outer Tracking commands keep their existing shipment/guest authority.
-- This adds public evidence facts only; qualification never gates ongoing work.
do $tracking_fact$
declare signature text:='public.tracking_public_truck_summary(uuid)';definition text;old_text text;new_text text;
begin
 definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$select jsonb_build_object('platformNumber',v.platform_number$old$;
 new_text:=$new$select jsonb_build_object('authority',public.provider_vehicle_authority_state(v.id),'platformNumber',v.platform_number$new$;
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_TRACKING_AUTHORITY_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $tracking_fact$;
notify pgrst,'reload schema';
commit;
