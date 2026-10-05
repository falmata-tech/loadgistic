-- FEAT-IAM-001: verified email synchronization and retained-history deactivation.
alter table public.profiles add column account_deactivated_at timestamptz;
create function public.sync_confirmed_auth_email() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.email is distinct from old.email and new.email_confirmed_at is not null and nullif(trim(new.email),'') is not null then
  update public.profiles set email=lower(trim(new.email)) where id=new.id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(new.id,'ACCOUNT_EMAIL_CHANGED','profile',new.id,'{}'::jsonb);
 end if;
 return new;
end $$;
create trigger sync_confirmed_loadgistic_email after update of email on auth.users
 for each row execute function public.sync_confirmed_auth_email();
revoke all on function public.sync_confirmed_auth_email() from public,anon,authenticated;

create function public.account_deactivation_blockers(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb:='[]'::jsonb; orgs uuid[]; providers uuid[];
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role in ('TRANSPORTER','DRIVER')) then raise exception 'FORBIDDEN';end if;
 select coalesce(array_agg(organization_id),'{}'::uuid[]) into orgs from organization_members where user_id=actor_user_id and membership_role='OWNER';
 select coalesce(array_agg(id),'{}'::uuid[]) into providers from provider_profiles where user_id=actor_user_id;
 if exists(select 1 from provider_shipments where operational_status not in ('COMPLETED','CANCELLED') and
  (assigned_driver_user_id=actor_user_id or provider_organization_id=any(orgs) or provider_profile_id=any(providers))) then result:=result||'"ACTIVE_TRACKING"'::jsonb;end if;
 if exists(select 1 from vehicles where active and (organization_id=any(orgs) or provider_profile_id=any(providers))) then result:=result||'"ACTIVE_TRUCKS"'::jsonb;end if;
 if exists(select 1 from driver_vehicle_assignments where driver_user_id=actor_user_id and active) then result:=result||'"DRIVER_ASSIGNMENT"'::jsonb;end if;
 if exists(select 1 from organization_members m join profiles p on p.id=m.user_id and p.active
   where m.organization_id=any(orgs) and m.user_id<>actor_user_id) then result:=result||'"ACTIVE_FLEET_MEMBERS"'::jsonb;end if;
 if exists(select 1 from fleet_driver_invitations where organization_id=any(orgs) and accepted_at is null and cancelled_at is null and expires_at>now()) then result:=result||'"PENDING_INVITATIONS"'::jsonb;end if;
 if exists(select 1 from support_conversations where customer_user_id=actor_user_id and status<>'CLOSED') then result:=result||'"OPEN_SUPPORT"'::jsonb;end if;
 return result;
end $$;

create function public.deactivate_own_account(actor_user_id uuid,confirmation text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare blockers jsonb; orgs uuid[]; providers uuid[];
begin
 if confirmation is distinct from 'DEACTIVATE' then raise exception 'ACCOUNT_CONFIRMATION_REQUIRED';end if;
 -- Fleet commands already serialize on the organization. Use that same order
 -- before locking the closing actor, then read blockers from fresh statements.
 perform 1 from organizations where id in (select organization_id from organization_members where user_id=actor_user_id and membership_role='OWNER') order by id for update;
 perform 1 from profiles where id=actor_user_id and active and role in ('TRANSPORTER','DRIVER') for update;
 if not found then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from auth.users where id=actor_user_id and email_confirmed_at is not null
   and last_sign_in_at>=clock_timestamp()-interval '10 minutes') then raise exception 'ACCOUNT_REAUTH_REQUIRED';end if;
 blockers:=account_deactivation_blockers(actor_user_id);
 if jsonb_array_length(blockers)>0 then raise exception 'ACCOUNT_HAS_ACTIVE_WORK';end if;
 select coalesce(array_agg(organization_id),'{}'::uuid[]) into orgs from organization_members where user_id=actor_user_id and membership_role='OWNER';
 select coalesce(array_agg(id),'{}'::uuid[]) into providers from provider_profiles where user_id=actor_user_id;
 update profiles set active=false,account_deactivated_at=clock_timestamp() where id=actor_user_id;
 update drivers set active=false where user_id=actor_user_id;
 update provider_profiles set public_visibility='PRIVATE' where id=any(providers);
 update organizations set public_visibility='PRIVATE' where id=any(orgs);
 update company_pages set published=false where organization_id=any(orgs) or provider_profile_id=any(providers);
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_DEACTIVATED','profile',actor_user_id,'{}'::jsonb);
 return jsonb_build_object('deactivated',true);
end $$;

-- Serialize active truck insertion/restoration against a provider's explicit closure.
create function public.require_active_vehicle_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not new.active then return new;end if;
 if new.provider_profile_id is not null then
  perform 1 from profiles p join provider_profiles owner on owner.user_id=p.id
   where owner.id=new.provider_profile_id and p.active for key share of p;
 else
  perform 1 from profiles p join organization_members m on m.user_id=p.id
   where m.organization_id=new.organization_id and m.membership_role='OWNER' and p.active for key share of p;
 end if;
 if not found then raise exception 'VEHICLE_OWNER_INACTIVE';end if;
 return new;
end $$;
create trigger vehicle_requires_active_owner before insert or update of active,organization_id,provider_profile_id on public.vehicles
 for each row execute function public.require_active_vehicle_owner();
revoke all on function public.require_active_vehicle_owner() from public,anon,authenticated;
revoke all on function public.account_deactivation_blockers(uuid) from public,anon,authenticated;
revoke all on function public.deactivate_own_account(uuid,text) from public,anon,authenticated;
grant execute on function public.account_deactivation_blockers(uuid) to service_role;
grant execute on function public.deactivate_own_account(uuid,text) to service_role;

-- Active assignments and Support creation must not race a successful closure.
create function public.require_active_work_participant() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare participant uuid;
begin
 if tg_table_name='driver_vehicle_assignments' then
  if not new.active then return new;end if;participant:=new.driver_user_id;
 elsif tg_table_name='support_conversations' then
  if new.status='CLOSED' then return new;end if;participant:=new.customer_user_id;
 else raise exception 'INVALID_ACCOUNT_WORK_BOUNDARY';end if;
 perform 1 from profiles where id=participant and active for key share;
 if not found then raise exception 'FORBIDDEN';end if;
 return new;
end $$;
create trigger assignment_requires_active_driver before insert or update of active,driver_user_id on public.driver_vehicle_assignments
 for each row execute function public.require_active_work_participant();
create trigger support_requires_active_customer before insert or update of status,customer_user_id on public.support_conversations
 for each row execute function public.require_active_work_participant();
revoke all on function public.require_active_work_participant() from public,anon,authenticated;

do $migration$
declare definition text; old_fragment text:=E'  perform 1 from organizations where id=org for update;';
begin
 definition:=pg_get_functiondef('public.fleet_invite_driver(uuid,jsonb)'::regprocedure);
 if position(old_fragment in definition)=0 then raise exception 'FLEET_INVITATION_CLOSURE_CONTRACT_NOT_FOUND';end if;
 -- Recheck current owner authority after the shared lock; a pre-lock scope is stale.
 execute replace(definition,old_fragment,old_fragment||E'\n  org:=public.fleet_owner_organization(actor_user_id);');
end $migration$;
revoke all on function public.fleet_invite_driver(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fleet_invite_driver(uuid,jsonb) to service_role;
