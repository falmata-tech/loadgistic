-- FEAT-FLT/VER/APP/IAM-001: advertise only the complete installed provider contract.
begin;
select pg_advisory_xact_lock(8030150);
do $contract$
declare signature text;
begin
 foreach signature in array array['public.fleet_provider_owner_scope(uuid)',
  'public.provider_account_capabilities(uuid)','public.provider_vehicle_authority_state(uuid)',
  'public.set_provider_vehicle_publication(uuid,uuid,text)','public.set_provider_driving_mode(uuid,boolean)',
  'public.prepare_account_erasure(uuid,uuid)','public.finish_account_erasure(uuid,uuid)'] loop
  if to_regprocedure(signature) is null then raise exception 'PROVIDER_FLEET_CONTRACT_INCOMPLETE';end if;
 end loop;
 if not exists(select 1 from public.platform_controls where singleton and independent_single_truck=false)
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='vehicles' and column_name='publication_status')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='drivers' and column_name='provider_profile_id')
 then raise exception 'PROVIDER_FLEET_CONTRACT_INCOMPLETE';end if;
end $contract$;
alter table public.platform_controls add column provider_owner_fleets boolean not null default true check(provider_owner_fleets);
comment on column public.platform_controls.provider_owner_fleets is '145/146/148/149 provider owner fleet, reviewed publication, driving intent and erasure compatibility contract; no billing change.';
notify pgrst,'reload schema';
commit;
