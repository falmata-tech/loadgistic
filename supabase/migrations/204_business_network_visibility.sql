-- FEAT-CON-001. A shipper/broker may opt in to a signed-in directory count.
-- Vehicle identities and connection names remain private.
begin;
select pg_advisory_xact_lock(8030204);
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.business_workspaces
 add column show_network_size boolean not null default false;

create function public.business_network_preference(actor_user_id uuid,target_workspace_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,auth,pg_temp as $$
declare saved record;
begin
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'OWNER')
 then raise exception 'NETWORK_FORBIDDEN';end if;
 select show_network_size,version into saved from public.business_workspaces
 where id=target_workspace_id and active;
 if not found then raise exception 'NETWORK_FORBIDDEN';end if;
 return jsonb_build_object('visible',saved.show_network_size,'version',saved.version);
end $$;

create function public.set_business_network_visibility(actor_user_id uuid,target_workspace_id uuid,
 expected_version bigint,visible boolean)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth,pg_temp as $$
declare saved public.business_workspaces%rowtype;
begin
 if visible is null or expected_version is null or expected_version<1
 then raise exception 'NETWORK_INVALID_INPUT';end if;
 select * into saved from public.business_workspaces
 where id=target_workspace_id for update;
 if not found or not saved.active or not public.business_workspace_permission(actor_user_id,target_workspace_id,'OWNER')
 then raise exception 'NETWORK_FORBIDDEN';end if;
 if saved.version<>expected_version then raise exception 'NETWORK_REVISION_CONFLICT';end if;
 if saved.show_network_size is distinct from visible then
  update public.business_workspaces set show_network_size=visible,
   version=version+1,updated_at=clock_timestamp() where id=target_workspace_id
   returning * into saved;
  insert into public.business_workspace_audit(workspace_id,actor_user_id,action)
   values(target_workspace_id,actor_user_id,'NETWORK_VISIBILITY_CHANGED');
 end if;
 return jsonb_build_object('visible',saved.show_network_size,'version',saved.version);
end $$;

create function public.account_directory_network_sizes(actor_user_id uuid,account_kinds text[],account_ids uuid[])
returns table(kind text,id uuid,network_size bigint)
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare actor record;
begin
 select * into actor from public.directory_actor_account(actor_user_id);
 if not found then raise exception 'DIRECTORY_FORBIDDEN';end if;
 if account_kinds is null or account_ids is null
  or cardinality(account_kinds)<>cardinality(account_ids)
  or cardinality(account_ids)>8 or array_position(account_kinds,null) is not null
  or array_position(account_ids,null) is not null
 then raise exception 'DIRECTORY_INVALID_INPUT';end if;
 return query
 select input.account_kind,input.account_id,
  case when input.account_kind='BUSINESS' and w.active and w.show_network_size
   and public.directory_account_visible('BUSINESS',input.account_id)
   and public.directory_account_review_scope('BUSINESS',input.account_id)
       =public.directory_account_review_scope(actor.subject_kind,actor.subject_id)
   then (select count(distinct grants.vehicle_id) from (
    select g.vehicle_id from public.account_capacity_grants g
     where g.recipient_kind='BUSINESS' and g.recipient_id=input.account_id
      and public.account_capacity_grant_valid(g.id)
    union
    select g.vehicle_id from public.business_capacity_grants g
     where g.workspace_id=input.account_id and g.revoked_at is null
      and public.capacity_sharing_mode(g.vehicle_id) in('PRIVATE','BOTH')
   ) grants)
   else null::bigint end
 from unnest(account_kinds,account_ids) with ordinality
  as input(account_kind,account_id,position)
 left join public.business_workspaces w on w.id=input.account_id and input.account_kind='BUSINESS'
 order by input.position;
end $$;

revoke all on function public.business_network_preference(uuid,uuid),
 public.set_business_network_visibility(uuid,uuid,bigint,boolean),
 public.account_directory_network_sizes(uuid,text[],uuid[])
 from public,anon,authenticated;
grant execute on function public.business_network_preference(uuid,uuid),
 public.set_business_network_visibility(uuid,uuid,bigint,boolean),
 public.account_directory_network_sizes(uuid,text[],uuid[])
 to service_role;
notify pgrst,'reload schema';
commit;
