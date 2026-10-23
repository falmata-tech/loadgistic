-- FEAT-SIM-001. Permit only the eight exact fixture owners to provision their
-- fictional GPS devices. This does not change synthetic engine-command access.
begin;
select pg_advisory_xact_lock(8030184);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $patch$
declare definition text; anchor text; replacement text;
begin
 definition:=pg_get_functiondef('public.provision_telematics_device_pre_privacy154(uuid,jsonb)'::regprocedure);
 anchor:='not public.telematics_is_demo_owner(owner_id)';
 if md5(definition)<>'813660d1e3ab3a0278518adf21af058f'
  or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  or (select count(*) from public.demo_motion_fleet_allowlist)<>8
 then raise exception 'DEMO_COHORT_PROVISION_GUARD_DRIFT';end if;
 replacement:=$guard$not (public.telematics_is_demo_owner(owner_id) or
  (owner_org is not null and exists(
   select 1 from public.demo_motion_fleet_allowlist allowed
   join auth.users owner on owner.id=owner_id and owner.deleted_at is null
   join public.profiles profile on profile.id=owner.id and profile.active and profile.role='TRANSPORTER'
   join public.organization_members member on member.organization_id=allowed.organization_id
    and member.user_id=owner.id and member.membership_role='OWNER'
   where allowed.organization_id=owner_org
    and allowed.imei=provision_telematics_device_pre_privacy154.command->>'imei'
    and owner.raw_app_meta_data->>'fixture_source'='loadgistic'
    and owner.raw_user_meta_data->>'fixture_key'=allowed.owner_fixture_key
    and (lower(owner.email)=allowed.owner_email
     or lower(owner.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')
  )))$guard$;
 execute replace(definition,anchor,replacement);
end $patch$;

notify pgrst,'reload schema';
commit;
