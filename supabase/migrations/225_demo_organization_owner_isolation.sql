-- FEAT-SIM-001 / NR-83. An exact demo organization cannot gain a normal co-owner
-- while its remaining marked owner continues to authorize simulated mutations.
-- Source pins refer to final197 / reserved Tracking191+194 prosrc, not old195.
-- No account, membership, page, scenario control, job or receipt is rewritten.
begin;
select pg_advisory_xact_lock(8030225);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $isolation$
declare item record;original record;after_change record;definition text;patched text;
 anchor text;replacement text;
begin
 -- Check all definitions and browser/private execution boundaries before edits.
 for item in select * from(values
  ('public.demo_world_execute_profile(bigint,uuid)',
   '4c78a57bb111bf895a525f31cfd7eb4f','plpgsql','v','jsonb',true,
   array['search_path=pg_catalog, public, auth, pg_temp']::text[]),
  ('public.demo_world_tracking_lifecycle_actor_ready()',
   '5b01d86bd497eadbf363b413b4c8b919','sql','s','boolean',false,
   array['search_path=public, pg_temp']::text[]),
  ('public.demo_world_tracking_live_actor_ready()',
   '5b01d86bd497eadbf363b413b4c8b919','sql','s','boolean',false,
   array['search_path=public, pg_temp']::text[])
 ) expected(signature,body_md5,language_name,volatility,return_type,service_execute,configuration) loop
  select p.oid,p.prosrc,p.prosecdef,p.provolatile,p.prorettype,p.proretset,p.proconfig,l.lanname
   into original from pg_proc p join pg_language l on l.oid=p.prolang
   where p.oid=to_regprocedure(item.signature);
  if not found or md5(original.prosrc)<>item.body_md5 or not original.prosecdef
   or original.provolatile::text<>item.volatility or original.lanname<>item.language_name
   or original.prorettype<>item.return_type::regtype or original.proretset
   or original.proconfig is distinct from item.configuration
   or has_function_privilege('anon',original.oid,'EXECUTE')
   or has_function_privilege('authenticated',original.oid,'EXECUTE')
   or has_function_privilege('service_role',original.oid,'EXECUTE') is distinct from item.service_execute
   then raise exception 'DEMO_ORG_ISOLATION_DEFINITION_DRIFT:%',item.signature;end if;
 end loop;

 for item in select * from(values
  ('public.demo_world_execute_profile(bigint,uuid)',true),
  ('public.demo_world_tracking_lifecycle_actor_ready()',false),
  ('public.demo_world_tracking_live_actor_ready()',false)
 ) edits(signature,profile_executor) loop
  select p.oid,p.proowner,p.proacl,p.proconfig into original
   from pg_proc p where p.oid=item.signature::regprocedure;
  definition:=pg_get_functiondef(original.oid);patched:=definition;
  if item.profile_executor then
   -- Same control -> job order as the Capacity controller. Operator operations
   -- that change both controls must use global -> profile order as well.
   -- Merely acquiring these locks does not refuse a valid disabled DONE replay.
   anchor:=$old$ select * into job from public.demo_world_profile_jobs where id=job_id for update;$old$;
   replacement:=$new$ perform 1 from public.demo_world_control where id=1 for share;
 perform 1 from public.demo_world_profile_control where id=1 for share;
 select * into job from public.demo_world_profile_jobs where id=job_id for update;$new$;
   if (length(patched)-length(replace(patched,anchor,'')))/length(anchor)<>1
    then raise exception 'DEMO_ORG_ISOLATION_ANCHOR_DRIFT:%',item.signature;end if;
   patched:=replace(patched,anchor,replacement);
   anchor:=$old$ if job.copy_version<>2 or job.state<>'LEASED' or job.lease_expires_at<=now_value$old$;
   replacement:=$new$ now_value:=clock_timestamp(); -- Refresh after control/job waits and after DONE replay.
 if job.copy_version<>2 or job.state<>'LEASED' or job.lease_expires_at<=now_value$new$;
   if (length(patched)-length(replace(patched,anchor,'')))/length(anchor)<>1
    then raise exception 'DEMO_ORG_ISOLATION_ANCHOR_DRIFT:%',item.signature;end if;
   patched:=replace(patched,anchor,replacement);
   -- Keep the existing page -> organization lock order used by human page edits.
   -- NOWAIT also refuses the reverse deactivation order without a lock cycle.
   -- A busy refusal is not proof of changed identity; a later valid retry is safe.
   anchor:=$old$ if before_page.headline is distinct from old_copy->>'headline'$old$;
   replacement:=$new$ -- The page is already locked by final197 before this bounded owner proof.
 begin
  perform 1 from public.organizations provider
   where provider.id=target.organization_id for update nowait;
  perform 1 from public.organization_members member
   where member.organization_id=target.organization_id order by member.id for share nowait;
 exception when lock_not_available then
  raise exception 'DEMO_PROFILE_ACTOR_REFUSED';
 end;
 if (select count(*) from public.organization_members member
    where member.organization_id=target.organization_id and member.membership_role='OWNER')<>1
  or not exists(select 1 from public.organization_members member
    where member.organization_id=target.organization_id and member.membership_role='OWNER'
      and member.user_id=target.actor_id)
 then raise exception 'DEMO_PROFILE_ACTOR_REFUSED';end if;
 if before_page.headline is distinct from old_copy->>'headline'$new$;
   if (length(patched)-length(replace(patched,anchor,'')))/length(anchor)<>1
    then raise exception 'DEMO_ORG_ISOLATION_ANCHOR_DRIFT:%',item.signature;end if;
   patched:=replace(patched,anchor,replacement);
   anchor:=$old$ saved_id:=public.update_provider_profile_page(target.actor_id,jsonb_build_object($old$;
   replacement:=$new$ -- Lock waits must not turn an expired old lease into a new publication.
 if job.lease_expires_at<=clock_timestamp() then raise exception 'DEMO_PROFILE_LEASE_REFUSED';end if;
 saved_id:=public.update_provider_profile_page(target.actor_id,jsonb_build_object($new$;
  else
   anchor:=$old$      and vehicle.provider_profile_id is null and vehicle.active$old$;
   replacement:=$new$      and vehicle.provider_profile_id is null and vehicle.active
      and (select count(*) from public.organization_members owner_membership
        where owner_membership.organization_id=vehicle.organization_id
          and owner_membership.membership_role='OWNER')=1$new$;
  end if;
  if (length(patched)-length(replace(patched,anchor,'')))/length(anchor)<>1
   then raise exception 'DEMO_ORG_ISOLATION_ANCHOR_DRIFT:%',item.signature;end if;
  patched:=replace(patched,anchor,replacement);execute patched;
  select p.oid,p.proowner,p.proacl,p.proconfig into after_change
   from pg_proc p where p.oid=item.signature::regprocedure;
  if after_change.oid<>original.oid or after_change.proowner<>original.proowner
   or after_change.proacl is distinct from original.proacl
   or after_change.proconfig is distinct from original.proconfig
   then raise exception 'DEMO_ORG_ISOLATION_METADATA_DRIFT:%',item.signature;end if;
 end loop;
end $isolation$;
commit;
