-- FEAT-ENT/TRQ/SHR/SUP/GST-001. Retire platform Brokerage, not software Support.
-- Compatible additive retirement: preserve private records, audit and old fields.
begin;
select pg_advisory_xact_lock(8030159);
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Retired events cannot generate new deliveries during the capability transition.
drop trigger if exists native_push_brokerage_message on public.transport_chat_messages;
drop trigger if exists native_push_brokerage_state on public.transport_service_requests;
drop trigger if exists native_push_brokerage_join on public.transport_chat_read_cursors;
drop trigger if exists native_push_brokerage_end on public.transport_chat_access;
update public.native_push_outbox set state='CANCELLED',outcome_code='SERVICE_RETIRED',lease_id=null,leased_until=null
 where kind='BROKERAGE' and state in('PENDING','SENDING','SUBMITTED','CHECKING');
update public.native_push_bindings set expires_at=least(expires_at,clock_timestamp()) where audience='GUEST';

-- Do not transfer obsolete Brokerage work or silently give its workers Support.
drop trigger if exists brokerage_permission_revoked on public.support_agent_profiles;
drop trigger if exists brokerage_account_suspended on public.profiles;
update public.support_agent_profiles set can_manage_brokerage=false where can_manage_brokerage;

create or replace function public.can_manage_brokerage(actor_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$select false$$;
create or replace function public.can_access_transport_chat(request_id uuid,access_digest text,actor_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$select false$$;
create or replace function public.private_capacity_operations_actor(actor_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$select false$$;

-- Retain signatures/defaults for old clients while denying every active port.
-- No table is dropped and no transcript/contact/history is made public.
do $retire_commands$
declare routine record;definition text;
begin
 for routine in select p.oid,p.proname,pg_get_function_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as result
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
   'create_transport_service_request','transport_service_request_inbox','update_transport_service_request','brokerage_request_inbox',
   'assign_transport_service_request','create_transport_chat_request','transport_chat_snapshot','send_transport_chat_message',
   'end_transport_chat','lock_brokerage_actor','set_loadgistic_capacity_access']) loop
  definition:=format('create or replace function public.%I(%s) returns %s language plpgsql security definer set search_path=public,pg_temp as $retired$ begin raise exception ''PLATFORM_BROKERAGE_RETIRED'';end $retired$',routine.proname,routine.arguments,routine.result);
  execute definition;
 end loop;
end $retire_commands$;

-- Public, email and later business audiences retain the same projections. A
-- private implementation copy cannot become an alternate service-role bypass.
do $retire_audience$
declare routine record;definition text;copy_name text;call_args text;copy_signature text;body text;
begin
 for routine in select p.oid,p.proname,p.proargnames,p.pronargs,p.proretset,
   pg_get_function_arguments(p.oid) as arguments,pg_get_function_identity_arguments(p.oid) as identity_arguments,
   pg_get_function_result(p.oid) as result
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
   'private_capacity_projection','private_capacity_filtered_page','capacity_search_private_rows','capacity_search_results']) loop
  copy_name:=routine.proname||'_pre_retirement159';definition:=pg_get_functiondef(routine.oid);
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=copy_name) then raise exception 'BROKERAGE_RETIREMENT_BACKUP_EXISTS';end if;
  execute replace(replace(definition,'CREATE OR REPLACE FUNCTION public.'||routine.proname||'(','CREATE OR REPLACE FUNCTION public.'||copy_name||'('),routine.proname||'.',copy_name||'.');
  copy_signature:=format('public.%I(%s)',copy_name,routine.identity_arguments);
  execute 'revoke all on function '||copy_signature||' from public,anon,authenticated,service_role';
  select string_agg(quote_ident(name),',' order by ordinal) into call_args from unnest(routine.proargnames[1:routine.pronargs]) with ordinality names(name,ordinal);
  body:=case when routine.proretset then 'return query select * from public.' else 'return public.' end||quote_ident(copy_name)||'('||call_args||');';
  execute format('create or replace function public.%I(%s) returns %s language plpgsql stable security definer set search_path=public,extensions,pg_temp as $retired$ begin if upper(requested_audience)=''LOADGISTIC'' then raise exception ''PLATFORM_CAPACITY_RETIRED'';end if;%s end $retired$',routine.proname,routine.arguments,routine.result,body);
 end loop;
end $retire_audience$;

with retired as(
 update public.capacity_access_grants set revoked_at=clock_timestamp() where audience_type='LOADGISTIC' and revoked_at is null returning id,vehicle_id
)
insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
 select null,'PLATFORM_CAPACITY_RETIRED','capacity_access_grant',id,jsonb_build_object('vehicleId',vehicle_id,'migration',159) from retired;

create function public.prevent_retired_platform_capability()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='support_agent_profiles' then
  if new.can_manage_brokerage then raise exception 'PLATFORM_BROKERAGE_RETIRED';end if;
 elsif new.audience_type='LOADGISTIC' and new.revoked_at is null then raise exception 'PLATFORM_CAPACITY_RETIRED';end if;
 return new;
end $$;
create trigger retired_brokerage_capability before insert or update of can_manage_brokerage on public.support_agent_profiles
 for each row execute function public.prevent_retired_platform_capability();
create trigger retired_platform_capacity before insert or update on public.capacity_access_grants
 for each row execute function public.prevent_retired_platform_capability();
revoke all on function public.prevent_retired_platform_capability() from public,anon,authenticated,service_role;

-- Shared read/receipt/alert and push functions call the false access helpers.
-- Their Support and HANDOVER branches remain installed and retain their ACLs.
-- History remains inaccessible through retired application ports; destructive
-- retention/deletion or restoring these capabilities requires a separate review.
notify pgrst,'reload schema';
commit;
