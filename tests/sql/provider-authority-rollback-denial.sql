-- ADR-079 / FEAT-FLT/VER-001 / NR-47. Isolated clone only; rollback-only.
-- The runner must supply -v provider_authority_rollback_source=<exact contents of
-- supabase/rollbacks/146_provider_vehicle_authority.sql> as a structured argv
-- value. No shell substitution, server file read or production target is needed.
\set ON_ERROR_STOP on
begin;
create temporary table authority_rollback_source(source text not null) on commit drop;
insert into authority_rollback_source values (:'provider_authority_rollback_source');
create temporary table authority_rollback_functions on commit drop as
select p.oid::regprocedure::text as signature,md5(pg_get_functiondef(p.oid)) as definition_md5,
 p.proowner,p.proacl,p.proconfig,obj_description(p.oid,'pg_proc') as description
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p');
create temporary table authority_rollback_boundary on commit drop as
select c.provider_owner_fleets,pg_get_triggerdef(t.oid) as publication_trigger
from public.platform_controls c cross join pg_trigger t
where c.singleton and c.provider_owner_fleets and not t.tgisinternal
 and t.tgrelid='public.capacities'::regclass and t.tgname='provider_capacity_publication';
do $test$
declare recovery_source text;rejected boolean:=false;rejection_message text;
begin
 if(select count(*) from authority_rollback_boundary)<>1 then raise exception 'ROLLBACK_DENIAL_BOUNDARY_MISSING';end if;
 select source into strict recovery_source from authority_rollback_source;
 begin
  execute recovery_source;
 exception when sqlstate '55000' then
  get stacked diagnostics rejection_message=message_text;
  if rejection_message<>'PROVIDER_AUTHORITY_FORWARD_REPAIR_REQUIRED' then raise exception 'ROLLBACK_DENIAL_WRONG_REASON';end if;
  rejected:=true;
 end;
 if not rejected then raise exception 'UNSAFE_AUTHORITY_ROLLBACK_EXECUTED';end if;
 if exists(
  (select * from authority_rollback_functions except
   select p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)),p.proowner,p.proacl,p.proconfig,obj_description(p.oid,'pg_proc')
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p'))
  union all
  (select p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)),p.proowner,p.proacl,p.proconfig,obj_description(p.oid,'pg_proc')
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')
   except select * from authority_rollback_functions)
 ) then raise exception 'ROLLBACK_DENIAL_FUNCTION_METADATA_CHANGED';end if;
 if exists(
  (select * from authority_rollback_boundary except
   select c.provider_owner_fleets,pg_get_triggerdef(t.oid) from public.platform_controls c cross join pg_trigger t
   where c.singleton and not t.tgisinternal and t.tgrelid='public.capacities'::regclass and t.tgname='provider_capacity_publication')
  union all
  (select c.provider_owner_fleets,pg_get_triggerdef(t.oid) from public.platform_controls c cross join pg_trigger t
   where c.singleton and not t.tgisinternal and t.tgrelid='public.capacities'::regclass and t.tgname='provider_capacity_publication'
   except select * from authority_rollback_boundary)
 ) then raise exception 'ROLLBACK_DENIAL_PUBLICATION_BOUNDARY_CHANGED';end if;
 raise notice 'PASS: exact rollback artifact denies before mutation; function definitions, ownership, ACLs, settings, comments, publication trigger and runtime marker unchanged';
end $test$;
rollback;
