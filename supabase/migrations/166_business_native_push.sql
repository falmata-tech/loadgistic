-- FEAT-ENT-001 / FEAT-NOT-001: own-person Support push for current business members.
-- Registration is never chat authority. Every deferred send rechecks the same
-- installation, exact Auth session, identity and current membership.
begin;
select pg_advisory_xact_lock(8030166);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $business_native_push$
declare routine regprocedure;definition text;
 before_text text:=$before$p.role in ('DRIVER','TRANSPORTER')$before$;
 after_text text:=$after$(p.role in ('DRIVER','TRANSPORTER') or exists(
    select 1 from public.business_workspace_members push_member
    where push_member.user_id=p.id
     and public.business_workspace_permission(p.id,push_member.workspace_id,'ACCESS')))
   and exists(select 1 from auth.users push_identity where push_identity.id=p.id
    and push_identity.email_confirmed_at is not null and push_identity.deleted_at is null
    and nullif(trim(push_identity.email),'') is not null
    and (push_identity.banned_until is null or push_identity.banned_until<=now()))$after$;
begin
 foreach routine in array array[
  'public.native_push_binding_active(uuid)'::regprocedure,
  'public.register_native_push_binding(uuid,text,text,text,uuid,uuid,uuid,text)'::regprocedure
 ] loop
  definition:=pg_get_functiondef(routine);
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
   raise exception 'BUSINESS_NATIVE_PUSH_DRIFT';
  end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $business_native_push$;

-- CREATE OR REPLACE preserves the original private ACLs. Do not grant the
-- internal binding predicate to callers or revive the retired GUEST helper.
notify pgrst,'reload schema';
commit;
