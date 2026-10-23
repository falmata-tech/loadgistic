-- FEAT-IAM/FLT/PLY-001: preserve employee access and private invitation erasure
-- when the employer uses the existing personal-provider anchor rather than org.
-- Retained-history deactivation keeps the same active-work and recent-proof
-- policy for both employer anchors; no existing identity/history is deleted.
begin;
select pg_advisory_xact_lock(8030149);
set local lock_timeout='5s';
set local statement_timeout='30s';
do $backup$
declare signature text;name text;backup_signature text;definition text;
begin
 foreach signature in array array['public.prepare_account_erasure(uuid,uuid)','public.finish_account_erasure(uuid,uuid)',
  'public.account_deactivation_blockers(uuid)','public.deactivate_own_account(uuid,text)'] loop
  name:=split_part(split_part(signature,'(',1),'.',2);backup_signature:=replace(signature,'public.'||name||'(','public.'||name||'_pre_fleet149(');
  if to_regprocedure(backup_signature) is not null then raise exception 'FLEET_ERASURE_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||name||'_pre_fleet149(');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_signature);
  execute format('comment on function %s is %L',backup_signature,jsonb_build_object('migration',149,'original_signature',signature,'before_md5',md5(definition),
   'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure))::text);
 end loop;
end $backup$;
do $employee_hold$
declare signature text:='public.prepare_account_erasure(uuid,uuid)';definition text;old_text text;new_text text;
begin
 definition:=pg_get_functiondef(signature::regprocedure);
 for old_text,new_text in values
 ($old$ select * into subject from profiles where id=r.subject_user_id for update;$old$,
  $new$ perform 1 from provider_profiles where user_id=r.subject_user_id order by id for update;
 select * into subject from profiles where id=r.subject_user_id for update;$new$),
 ($old$ elsif exists(select 1 from organization_members m join profiles p on p.id=m.user_id where m.organization_id=any(orgs) and m.user_id<>subject.id and p.active) then$old$,
  $new$ elsif exists(select 1 from organization_members m join profiles p on p.id=m.user_id where m.organization_id=any(orgs) and m.user_id<>subject.id and p.active)
 or exists(select 1 from drivers d join profiles p on p.id=d.user_id where d.provider_profile_id=any(providers) and d.user_id<>subject.id and d.active and p.active) then$new$),
 ($old$Transfer or close your company workspace first so other drivers and owners do not lose their records.$old$,
  $new$Resolve your active fleet memberships first so other drivers and owners do not lose access to their records.$new$)
 loop
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'FLEET_ERASURE_HOLD_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
 signature:='public.finish_account_erasure(uuid,uuid)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$delete from fleet_driver_invitations where accepted_by=subject.id or organization_id=any(orgs) or lower(email)=lower(subject.email);$old$;
 new_text:=$new$delete from fleet_driver_invitations where accepted_by=subject.id or organization_id=any(orgs) or provider_profile_id=any(providers) or lower(email)=lower(subject.email);$new$;
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'FLEET_ERASURE_INVITATION_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $employee_hold$;
do $deactivation_hold$
declare signature text;definition text;old_text text;new_text text;
begin
 signature:='public.account_deactivation_blockers(uuid)';definition:=pg_get_functiondef(signature::regprocedure);
 for old_text,new_text in values
 ($old$ if exists(select 1 from organization_members m join profiles p on p.id=m.user_id and p.active
   where m.organization_id=any(orgs) and m.user_id<>actor_user_id) then result:=result||'"ACTIVE_FLEET_MEMBERS"'::jsonb;end if;$old$,
  $new$ if exists(select 1 from organization_members m join profiles p on p.id=m.user_id and p.active
   where m.organization_id=any(orgs) and m.user_id<>actor_user_id)
 or exists(select 1 from drivers d join profiles p on p.id=d.user_id and p.active
   where d.provider_profile_id=any(providers) and d.user_id<>actor_user_id and d.active)
 then result:=result||'"ACTIVE_FLEET_MEMBERS"'::jsonb;end if;$new$),
 ($old$ if exists(select 1 from fleet_driver_invitations where organization_id=any(orgs) and accepted_at is null and cancelled_at is null and expires_at>now()) then result:=result||'"PENDING_INVITATIONS"'::jsonb;end if;$old$,
  $new$ if exists(select 1 from fleet_driver_invitations where (organization_id=any(orgs) or provider_profile_id=any(providers))
   and accepted_at is null and cancelled_at is null and expires_at>now()) then result:=result||'"PENDING_INVITATIONS"'::jsonb;end if;$new$)
 loop
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'FLEET_DEACTIVATION_BLOCKER_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
 signature:='public.deactivate_own_account(uuid,text)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$ perform 1 from profiles where id=actor_user_id and active and role in ('TRANSPORTER','DRIVER') for update;$old$;
 new_text:=$new$ -- Match fleet_lock_provider_owner: employer anchor before actor profile.
 perform 1 from provider_profiles where user_id=actor_user_id order by id for update;
 perform 1 from profiles where id=actor_user_id and active and role in ('TRANSPORTER','DRIVER') for update;$new$;
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'FLEET_DEACTIVATION_LOCK_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $deactivation_hold$;
notify pgrst,'reload schema';
commit;
