-- FEAT-GPS-001 / ADR-080: preserve exact managed demo identities after the
-- owner's authorized email change. This is not a customer or device backfill.
begin;
select pg_advisory_xact_lock(8030153);

create or replace function public.telematics_is_demo_owner(target_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from auth.users u where u.id=target_user_id
  and u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key' in('user-transporter','user-driver')
  and(lower(u.email)=case u.raw_user_meta_data->>'fixture_key'
   when 'user-transporter' then 'transporter@loadgistic.local' when 'user-driver' then 'driver@loadgistic.local' end
   or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$'))
$$;
revoke all on function public.telematics_is_demo_owner(uuid) from public,anon,authenticated,service_role;

do $identity_guards$
declare signature text;definition text;before_text text;after_text text;
begin
 signature:='public.provision_telematics_device(uuid,jsonb)';
 definition:=pg_get_functiondef(signature::regprocedure);
 before_text:=$before$not exists(select 1 from auth.users u where u.id=owner_id
  and u.email like '%@loadgistic.local' and u.raw_app_meta_data->>'fixture_source'='loadgistic')$before$;
 after_text:='not public.telematics_is_demo_owner(owner_id)';
 if strpos(definition,after_text)=0 then
  if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'TELEMATICS_DEMO_OWNER_GUARD_DRIFT';end if;
  execute replace(definition,before_text,after_text);
 end if;
 signature:='public.authorize_synthetic_engine_command(uuid,jsonb)';
 definition:=pg_get_functiondef(signature::regprocedure);
 before_text:=$before$not exists(select 1 from auth.users where id=actor_user_id and last_sign_in_at>=stamp-interval '5 minutes'
   and email like '%@loadgistic.local' and raw_app_meta_data->>'fixture_source'='loadgistic')$before$;
 after_text:=$after$not public.telematics_is_demo_owner(actor_user_id)
  or not exists(select 1 from auth.users where id=actor_user_id and last_sign_in_at>=stamp-interval '5 minutes')$after$;
 if strpos(definition,after_text)=0 then
  if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'TELEMATICS_DEMO_STEPUP_GUARD_DRIFT';end if;
  execute replace(definition,before_text,after_text);
 end if;
end $identity_guards$;
-- Repeated application preserves the existing RPC ACLs; helper is never exposed.
notify pgrst,'reload schema';
commit;
