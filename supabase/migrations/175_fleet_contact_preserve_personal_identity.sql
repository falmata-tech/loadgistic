-- FEAT-IAM-001 / FEAT-FLT-001 / NR-40. A legacy fleet contact form has one
-- name field. It must not split or replace a driver's chosen public first name
-- and private Last / father name. Preserve scope, locks, callback and audit.
begin;
select pg_advisory_xact_lock(8030175);
set local lock_timeout='5s';
set local statement_timeout='30s';
do $repair$
declare
 signature regprocedure:='public.fleet_update_driver_contact(uuid,jsonb)'::regprocedure;
 definition text:=pg_get_functiondef(signature);
 old_fragment text:=$old$update profiles set full_name=name_value,first_name=split_part(name_value,' ',1),
  last_name=nullif(trim(substr(name_value,length(split_part(name_value,' ',1))+1)),''),
  public_callback_phone=phone_value,public_callback_phone_configured=true where id=driver_id;$old$;
 new_fragment text:=$new$update profiles set full_name=name_value,
  public_callback_phone=phone_value,public_callback_phone_configured=true where id=driver_id;$new$;
begin
 if (length(definition)-length(replace(definition,old_fragment,'')))/length(old_fragment)<>1
  or strpos(definition,'fleet_lock_provider_owner(actor_user_id)')=0
  or strpos(definition,'fleet_driver_matches_scope(driver_id,s.organization_id,s.provider_profile_id)')=0
  or strpos(definition,'''DRIVER_CONTACT_UPDATED''')=0
  then raise exception 'FLEET_PERSONAL_IDENTITY_PATCH_DRIFT';end if;
 execute replace(definition,old_fragment,new_fragment);
end $repair$;
-- CREATE OR REPLACE preserves the existing restricted ACL and function owner.
commit;
