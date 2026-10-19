-- FEAT-ENT/SHR/CAP-001. Explicit business audiences, never email-domain inference.
-- Reuses the installed rich private Capacity projection/matching contract.
begin;
select pg_advisory_xact_lock(8030161);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.business_capacity_grants (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.vehicles(id),
 workspace_id uuid not null references public.business_workspaces(id),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 revoked_by uuid references public.profiles(id),
 revision integer not null default 1 check(revision>0)
);
create unique index business_capacity_grants_current on public.business_capacity_grants(vehicle_id,workspace_id) where revoked_at is null;
create index business_capacity_grants_feed on public.business_capacity_grants(workspace_id,vehicle_id) where revoked_at is null;
alter table public.business_capacity_grants enable row level security;
revoke all on public.business_capacity_grants from public,anon,authenticated;
grant select,insert,update,delete on public.business_capacity_grants to service_role;

create function public.grant_business_capacity_access(actor_user_id uuid,target_vehicle_id uuid,target_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare saved business_capacity_grants%rowtype;
begin
 if not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then raise exception 'BUSINESS_FORBIDDEN';end if;
 perform 1 from vehicles where id=target_vehicle_id and active for update;
 if not found or not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then raise exception 'BUSINESS_FORBIDDEN';end if;
 perform 1 from business_workspaces where id=target_workspace_id and active for share;
 if not found then raise exception 'BUSINESS_FORBIDDEN';end if;
 if public.capacity_sharing_mode(target_vehicle_id)='EXCLUSIVE' then raise exception 'EXCLUSIVE_RECIPIENT_ONLY';end if;
 -- The explicit team-sharing save has the same PUBLIC -> BOTH behavior as an
 -- email-sharing save; no implicit conversion of an existing email grant.
 if public.capacity_sharing_mode(target_vehicle_id)='PUBLIC' then
  perform set_provider_capacity_sharing(actor_user_id,target_vehicle_id,'BOTH');
 end if;
 select * into saved from business_capacity_grants where vehicle_id=target_vehicle_id and workspace_id=target_workspace_id and revoked_at is null;
 if found then return jsonb_build_object('id',saved.id,'vehicleId',saved.vehicle_id,'workspaceId',saved.workspace_id,'revision',saved.revision,'created',false);end if;
 insert into business_capacity_grants(vehicle_id,workspace_id,created_by) values(target_vehicle_id,target_workspace_id,actor_user_id) returning * into saved;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details) values(actor_user_id,'BUSINESS_CAPACITY_GRANTED','business_capacity_grant',saved.id,jsonb_build_object('vehicleId',saved.vehicle_id,'workspaceId',saved.workspace_id));
 return jsonb_build_object('id',saved.id,'vehicleId',saved.vehicle_id,'workspaceId',saved.workspace_id,'revision',saved.revision,'created',true);
end $$;

create function public.revoke_business_capacity_access(actor_user_id uuid,target_grant_id uuid,expected_revision integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare saved business_capacity_grants%rowtype;
begin
 select * into saved from business_capacity_grants where id=target_grant_id;
 if not found or not public.private_capacity_actor_controls_vehicle(actor_user_id,saved.vehicle_id) then raise exception 'BUSINESS_FORBIDDEN';end if;
 perform 1 from vehicles where id=saved.vehicle_id for update;
 select * into saved from business_capacity_grants where id=target_grant_id for update;
 if not public.private_capacity_actor_controls_vehicle(actor_user_id,saved.vehicle_id) then raise exception 'BUSINESS_FORBIDDEN';end if;
 if saved.revision is distinct from expected_revision then raise exception 'BUSINESS_REVISION_CONFLICT';end if;
 if saved.revoked_at is null then
  update business_capacity_grants set revoked_at=clock_timestamp(),revoked_by=actor_user_id,revision=revision+1 where id=saved.id returning * into saved;
  insert into audit_logs(actor_user_id,action,entity_type,entity_id,details) values(actor_user_id,'BUSINESS_CAPACITY_REVOKED','business_capacity_grant',saved.id,jsonb_build_object('vehicleId',saved.vehicle_id,'workspaceId',saved.workspace_id));
 end if;
 return jsonb_build_object('id',saved.id,'revision',saved.revision,'revoked',true);
end $$;

-- Clone only the installed query's authorization CTE. The real route/area,
-- document, multiselect, geography, publication and first-name projection stays
-- intact; fail on drift instead of silently restoring an older query body.
do $projection$
declare definition text;before_text text;after_text text;header text;
begin
 definition:=pg_get_functiondef('public.capacity_search_private_rows_pre_retirement159(text,text,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 before_text:=$before$with authorized as (
    select distinct grant_record.vehicle_id
    from public.capacity_access_grants grant_record
    where public.capacity_sharing_allows(grant_record.vehicle_id,upper(requested_audience),requested_digest) and grant_record.audience_type=upper(requested_audience)
      and grant_record.recipient_email_digest=requested_digest
      and grant_record.revoked_at is null
      and (grant_record.expires_at is null or grant_record.expires_at>now())
      and (
        upper(requested_audience)='EMAIL' and actor_user_id is null
        or upper(requested_audience)='LOADGISTIC' and public.private_capacity_operations_actor(actor_user_id)
      )
  ), latest as ($before$;
 after_text:=$after$with authorized as (
    select vehicle_id,bool_or(team_share) as team_share from (
      select g.vehicle_id,true as team_share from public.business_capacity_grants g
      join public.business_workspaces w on w.id=g.workspace_id and w.active
      where g.workspace_id=target_workspace_id and g.revoked_at is null
       and public.business_workspace_permission(actor_user_id,target_workspace_id,'CAPACITY')
       and public.capacity_sharing_mode(g.vehicle_id) in ('PRIVATE','BOTH')
      union all
      select g.vehicle_id,false as team_share from public.capacity_access_grants g
      join auth.users u on u.id=actor_user_id and u.email_confirmed_at is not null
       and lower(trim(u.email))=g.recipient_email
      where g.audience_type='EMAIL' and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())
       and public.business_workspace_permission(actor_user_id,target_workspace_id,'CAPACITY')
       and public.capacity_sharing_allows(g.vehicle_id,'EMAIL',g.recipient_email_digest)
    ) shares group by vehicle_id
  ), latest as ($after$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'BUSINESS_CAPACITY_PROJECTION_DRIFT';end if;
 definition:=replace(definition,before_text,after_text);
 header:='public.capacity_search_private_rows_pre_retirement159(requested_audience text, requested_digest text, actor_user_id uuid,';
 if strpos(definition,header)=0 then raise exception 'BUSINESS_CAPACITY_SIGNATURE_DRIFT';end if;
 definition:=replace(definition,header,'public.business_capacity_rows(actor_user_id uuid, target_workspace_id uuid,');
 -- The share label is derived from the very same authorized CTE as the row.
 definition:=replace(definition,'select capacity.*,row_number()', 'select capacity.*,authorized.team_share,row_number()');
 if strpos(definition,'''id'',capacity.id,''vehicle_id'',capacity.vehicle_id,')=0 then raise exception 'BUSINESS_CAPACITY_LABEL_DRIFT';end if;
 definition:=replace(definition,'''id'',capacity.id,''vehicle_id'',capacity.vehicle_id,','''id'',capacity.id,''vehicle_id'',capacity.vehicle_id,''access_scope'',case when capacity.team_share then ''BUSINESS'' else ''PERSONAL'' end,');
 execute definition;
end $projection$;

create function public.business_capacity_filtered_page(actor_user_id uuid,target_workspace_id uuid,cursor_updated_at timestamptz default null,cursor_id uuid default null,requested_page_size integer default 100,query jsonb default '{}'::jsonb)
returns table(payload jsonb) language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
#variable_conflict use_variable
begin
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'CAPACITY') then raise exception 'BUSINESS_FORBIDDEN';end if;
 if jsonb_typeof(query)<>'object' then raise exception 'INVALID_BUSINESS_INPUT';end if;
 return query select r.payload from public.business_capacity_rows(actor_user_id,target_workspace_id,cursor_updated_at,cursor_id,least(100,greatest(12,requested_page_size)),query) r
 limit least(100,greatest(12,requested_page_size))+1;
end $$;

-- Reuse the ranked profile grouping over the authorized business feed only.
-- Text search has its own query and never inherits the truck-map filters.
do $search$
declare definition text;before_text text;after_text text;
begin
 definition:=pg_get_functiondef('public.capacity_search_results_pre_retirement159(jsonb,text,text,uuid,integer)'::regprocedure);
 before_text:='public.capacity_search_results_pre_retirement159(query jsonb, requested_audience text DEFAULT ''PUBLIC''::text, requested_digest text DEFAULT NULL::text, actor_user_id uuid DEFAULT NULL::uuid, requested_page integer DEFAULT 1)';
 if strpos(definition,before_text)=0 then raise exception 'BUSINESS_SEARCH_SIGNATURE_DRIFT';end if;
 definition:=replace(definition,before_text,'public.business_capacity_search(actor_user_id uuid, target_workspace_id uuid, search_text text, requested_page integer DEFAULT 1)');
 definition:=replace(definition,'declare answer jsonb;','declare query jsonb:=jsonb_build_object(''q'',search_text);answer jsonb;');
 before_text:='if requested_audience not in (''PUBLIC'',''EMAIL'',''LOADGISTIC'') or requested_audience is null then raise exception ''FORBIDDEN'';end if;';
 if strpos(definition,before_text)=0 then raise exception 'BUSINESS_SEARCH_PERMISSION_DRIFT';end if;
 definition:=replace(definition,before_text,'if not public.business_workspace_permission(actor_user_id,target_workspace_id,''CAPACITY'') then raise exception ''BUSINESS_FORBIDDEN'';end if;');
 before_text:=$before$with capacity as materialized (
  select payload from public.capacity_search_public_rows(query - 'viewport',null,null,14) where requested_audience='PUBLIC'
  union all
  select payload from public.capacity_search_private_rows(requested_audience,requested_digest,actor_user_id,null,null,100,query - 'viewport') where requested_audience<>'PUBLIC'
 )$before$;
 after_text:=$after$with capacity as materialized (
  select payload from public.business_capacity_rows(actor_user_id,target_workspace_id,null,null,100,query)
 )$after$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'BUSINESS_SEARCH_PROJECTION_DRIFT';end if;
 execute replace(definition,before_text,after_text);
end $search$;
revoke all on function public.business_capacity_search(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.business_capacity_search(uuid,uuid,text,integer) to service_role;

alter function public.private_capacity_network(uuid) rename to private_capacity_network_pre_business161;
create function public.private_capacity_network(actor_user_id uuid) returns table(payload jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_set(row.payload,'{grants}',coalesce((select jsonb_agg(g) from jsonb_array_elements(row.payload->'grants') g where g->>'audience_type'='EMAIL'),'[]'::jsonb))
 ||jsonb_build_object('business_grants',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'workspace_id',w.id,'name',w.name,'handle',w.handle,'kind',w.kind,'city',w.city,'revision',g.revision,'created_at',g.created_at,'revoked_at',g.revoked_at) order by g.created_at desc)
 from business_capacity_grants g join business_workspaces w on w.id=g.workspace_id where g.vehicle_id=(row.payload->>'id')::uuid),'[]'::jsonb))
 from public.private_capacity_network_pre_business161(actor_user_id) row
$$;
revoke all on function public.private_capacity_network_pre_business161(uuid),public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.grant_business_capacity_access(uuid,uuid,uuid),public.revoke_business_capacity_access(uuid,uuid,integer),public.business_capacity_filtered_page(uuid,uuid,timestamptz,uuid,integer,jsonb),public.private_capacity_network(uuid) from public,anon,authenticated;
grant execute on function public.grant_business_capacity_access(uuid,uuid,uuid),public.revoke_business_capacity_access(uuid,uuid,integer),public.business_capacity_filtered_page(uuid,uuid,timestamptz,uuid,integer,jsonb),public.private_capacity_network(uuid) to service_role;
notify pgrst,'reload schema';
commit;
