-- FEAT-CON-001. Account operating style is derived from current public fleet
-- and assignment facts. Reviewed evidence is kept separate from this label.
begin;
select pg_advisory_xact_lock(8030203);
set local lock_timeout='5s';
set local statement_timeout='30s';

create function public.directory_account_status(target_kind text,target_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare summary jsonb;vehicle_count integer;owned_count integer;financed_count integer;
 drives_current boolean:=false;
begin
 if not public.directory_account_visible(target_kind,target_id) then return null;end if;
 if target_kind='DRIVER' then return 'FLEET_DRIVER';end if;
 if target_kind='BUSINESS' then return null;end if;
 if target_kind not in('ORGANIZATION','PROVIDER_PROFILE') then return null;end if;
 summary:=public.provider_fleet_authority_summary(
  case when target_kind='ORGANIZATION' then target_id else null end,
  case when target_kind='PROVIDER_PROFILE' then target_id else null end);
 vehicle_count:=coalesce((summary->>'total')::integer,0);
 owned_count:=coalesce((summary->>'ownershipVerified')::integer,0);
 financed_count:=coalesce((summary->>'financedVerified')::integer,0);
 if vehicle_count=0 then return 'TRANSPORT_PROVIDER';end if;
 if vehicle_count>=2 then return 'FLEET_PROVIDER';end if;
 select exists(
  select 1 from public.vehicles v
  join public.driver_vehicle_assignments a on a.vehicle_id=v.id and a.active
  join public.profiles p on p.id=a.driver_user_id and p.active
  where v.active and v.publication_status='LIVE'
   and ((target_kind='ORGANIZATION' and v.organization_id=target_id and exists(
    select 1 from public.organization_members m where m.organization_id=target_id
     and m.user_id=a.driver_user_id and m.membership_role='OWNER'))
    or(target_kind='PROVIDER_PROFILE' and v.provider_profile_id=target_id and exists(
    select 1 from public.provider_profiles x where x.id=target_id and x.user_id=a.driver_user_id)))
   and public.capacity_public_policy_allows(v.id)
 ) into drives_current;
 if not drives_current then return 'ACCOUNT_MANAGED';end if;
 if owned_count>0 then return 'OWNER_OPERATED';end if;
 if financed_count>0 then return 'LICENSED_OPERATOR';end if;
 return 'SELF_MANAGED';
end $$;

create function public.account_directory_statuses(actor_user_id uuid,account_kinds text[],account_ids uuid[])
returns table(kind text,id uuid,status text) language plpgsql stable security definer
set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.directory_actor_account(actor_user_id)) then
  raise exception 'DIRECTORY_FORBIDDEN';end if;
 if coalesce(array_length(account_ids,1),0)>8 or
  coalesce(array_length(account_kinds,1),0)<>coalesce(array_length(account_ids,1),0)
  then raise exception 'DIRECTORY_INVALID_INPUT';end if;
 return query select account_kinds[n],account_ids[n],
  public.directory_account_status(account_kinds[n],account_ids[n])
 from generate_subscripts(account_ids,1) n;
end $$;

revoke all on function public.directory_account_status(text,uuid),
 public.account_directory_statuses(uuid,text[],uuid[]) from public,anon,authenticated;
grant execute on function public.account_directory_statuses(uuid,text[],uuid[]) to service_role;
commit;
