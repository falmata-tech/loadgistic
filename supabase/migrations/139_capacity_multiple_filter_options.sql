-- FEAT-MKT-001: bounded OR within each selected group, AND across groups.
-- Patch installed definitions so sharing, content policy, blocklists, JIT,
-- cursor order and document-cost fixes are retained rather than copied from112.
begin;
select pg_advisory_xact_lock(8030139);
do $backups$
declare signature text;name text;backup_name text;definition text;
begin
 for signature,name,backup_name in values
  ('public.public_capacity_page(jsonb,timestamptz,uuid,integer)','public_capacity_page','public_capacity_page_pre_filter_options'),
  ('public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)','capacity_search_public_rows','capacity_search_public_rows_pre_filter_options'),
  ('public.capacity_payload_matches(jsonb,jsonb)','capacity_payload_matches','capacity_payload_matches_pre_filter_options') loop
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=backup_name) then raise exception 'CAPACITY_FILTER_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(')<>1 then raise exception 'CAPACITY_FILTER_HEADER_DRIFT';end if;
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||backup_name||'(');
 end loop;
end $backups$;
revoke all on function public.public_capacity_page_pre_filter_options(jsonb,timestamptz,uuid,integer),
 public.capacity_search_public_rows_pre_filter_options(jsonb,timestamptz,uuid,integer),public.capacity_payload_matches_pre_filter_options(jsonb,jsonb)
 from public,anon,authenticated,service_role;

create function public.capacity_filter_values(value text,filter_key text) returns text[]
language plpgsql immutable set search_path=public,pg_temp as $$
declare allowed text[];parts text[];token text;result text[]:=array[]::text[];
begin
 allowed:=case filter_key
  when 'status' then array['EMPTY','PARTIAL'] when 'load_type' then array['FTL','PTL']
  when 'stop_option' then array['MULTI_PICK','MULTI_DROP'] when 'freshness' then array['FRESH','UPDATE_NEEDED']
  when 'vehicle_category' then array['Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck',
   'Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck',
   'Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer']
  else null end;
 if allowed is null then raise exception 'INVALID_CAPACITY_FILTER';end if;
 if value is null then return null;end if;
 if length(value)>2048 then raise exception 'INVALID_CAPACITY_FILTER';end if;
 if trim(value)='' then return null;end if;
 parts:=string_to_array(value,',');
 if cardinality(parts)>32 then raise exception 'INVALID_CAPACITY_FILTER';end if;
 foreach token in array parts loop
  if length(token)>128 then raise exception 'INVALID_CAPACITY_FILTER';end if;
  token:=case when filter_key='vehicle_category' then trim(token) else upper(trim(token)) end;
  if token='' or not(token=any(allowed)) then raise exception 'INVALID_CAPACITY_FILTER';end if;
  if not(token=any(result)) then result:=array_append(result,token);end if;
 end loop;
 return array(select item from unnest(result) item order by item collate "C");
end $$;
revoke all on function public.capacity_filter_values(text,text) from public,anon,authenticated,service_role;

do $public_filters$
declare signature text;definition text;old_text text;new_text text;
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamptz,uuid,integer)','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,'public.capacity_sharing_mode(candidate.vehicle_id) in (''PUBLIC'',''BOTH'')')=0
   or strpos(definition,'blocked.content_hidden or blocked.review_workspace')=0 then raise exception 'CAPACITY_CURRENT_PRIVACY_CONTRACT_MISSING';end if;
  for old_text,new_text in values
   ($old$upper(nullif(trim(query->>'status'),'')) as capacity_status$old$,$new$public.capacity_filter_values(query->>'status','status') as capacity_status$new$),
   ($old$nullif(trim(query->>'vehicle_category'),'') as vehicle_category$old$,$new$public.capacity_filter_values(query->>'vehicle_category','vehicle_category') as vehicle_category$new$),
   ($old$upper(nullif(trim(query->>'load_type'),'')) as load_type$old$,$new$public.capacity_filter_values(query->>'load_type','load_type') as load_type$new$),
   ($old$upper(nullif(trim(query->>'stop_option'),'')) as stop_option$old$,$new$public.capacity_filter_values(query->>'stop_option','stop_option') as stop_option$new$),
   ($old$upper(nullif(trim(query->>'freshness'),'')) as freshness$old$,$new$public.capacity_filter_values(query->>'freshness','freshness') as freshness$new$),
   ($old$coalesce(candidate.market_status,candidate.status::text)=input.capacity_status$old$,$new$coalesce(candidate.market_status,candidate.status::text)=any(input.capacity_status)$new$),
   ($old$input.capacity_status is distinct from 'PARTIAL' or input.geometry is distinct from 'RADIUS'$old$,$new$coalesce(candidate.market_status,candidate.status::text) is distinct from 'PARTIAL' or input.geometry is distinct from 'RADIUS'$new$),
   ($old$candidate.cargo_configuration=input.vehicle_category$old$,$new$candidate.cargo_configuration=any(input.vehicle_category)$new$),
   ($old$input.load_type='FTL' and candidate.accepts_full_load or input.load_type='PTL' and candidate.accepts_partial_load$old$,$new$'FTL'=any(input.load_type) and candidate.accepts_full_load or 'PTL'=any(input.load_type) and candidate.accepts_partial_load$new$),
   ($old$input.stop_option='MULTI_PICK' and candidate.accepts_multi_pick or input.stop_option='MULTI_DROP' and candidate.accepts_multi_drop$old$,$new$'MULTI_PICK'=any(input.stop_option) and candidate.accepts_multi_pick or 'MULTI_DROP'=any(input.stop_option) and candidate.accepts_multi_drop$new$),
   ($old$input.freshness='FRESH' and candidate.updated_at>=now()-interval '12 hours'$old$,$new$'FRESH'=any(input.freshness) and candidate.updated_at>=now()-interval '12 hours'$new$),
   ($old$input.freshness='UPDATE_NEEDED' and candidate.updated_at<now()-interval '12 hours'$old$,$new$'UPDATE_NEEDED'=any(input.freshness) and candidate.updated_at<now()-interval '12 hours'$new$) loop
   if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'CAPACITY_FILTER_ANCHOR_DRIFT: %',signature;end if;
   definition:=replace(definition,old_text,new_text);
  end loop;
  execute definition;
 end loop;
end $public_filters$;

do $private_filters$
declare definition text:=pg_get_functiondef('public.capacity_payload_matches(jsonb,jsonb)'::regprocedure);old_text text;new_text text;
begin
 for old_text,new_text in values
  ($old$ geometry_filter text:=nullif(upper(query->>'geometry'),'');$old$,$new$ geometry_filter text:=nullif(upper(query->>'geometry'),'');
 status_values text[]:=public.capacity_filter_values(query->>'status','status');
 configuration_values text[]:=public.capacity_filter_values(query->>'vehicle_category','vehicle_category');
 load_values text[]:=public.capacity_filter_values(query->>'load_type','load_type');
 stop_values text[]:=public.capacity_filter_values(query->>'stop_option','stop_option');
 freshness_values text[]:=public.capacity_filter_values(query->>'freshness','freshness');$new$),
  ($old$ if nullif(query->>'status','') is not null and item->>'status'<>upper(query->>'status') then return false;end if;$old$,$new$ if status_values is not null and not coalesce(item->>'status'=any(status_values),false) then return false;end if;$new$),
  ($old$ if nullif(query->>'vehicle_category','') is not null and item->>'cargo_configuration'<>query->>'vehicle_category' then return false;end if;$old$,$new$ if configuration_values is not null and not coalesce(item->>'cargo_configuration'=any(configuration_values),false) then return false;end if;$new$),
  ($old$ if query->>'load_type'='FTL' and not coalesce((item->>'accepts_full_load')::boolean,false) then return false;end if;
 if query->>'load_type'='PTL' and not coalesce((item->>'accepts_partial_load')::boolean,false) then return false;end if;$old$,$new$ if load_values is not null and not (
  'FTL'=any(load_values) and coalesce((item->>'accepts_full_load')::boolean,false)
  or 'PTL'=any(load_values) and coalesce((item->>'accepts_partial_load')::boolean,false)) then return false;end if;$new$),
  ($old$ if query->>'stop_option'='MULTI_PICK' and not coalesce((item->>'accepts_multi_pick')::boolean,false) then return false;end if;
 if query->>'stop_option'='MULTI_DROP' and not coalesce((item->>'accepts_multi_drop')::boolean,false) then return false;end if;$old$,$new$ if stop_values is not null and not (
  'MULTI_PICK'=any(stop_values) and coalesce((item->>'accepts_multi_pick')::boolean,false)
  or 'MULTI_DROP'=any(stop_values) and coalesce((item->>'accepts_multi_drop')::boolean,false)) then return false;end if;$new$),
  ($old$ if query->>'freshness'='FRESH' and (item->>'updated_at')::timestamptz<now()-interval '12 hours' then return false;end if;
 if query->>'freshness'='UPDATE_NEEDED' and (item->>'updated_at')::timestamptz>=now()-interval '12 hours' then return false;end if;$old$,$new$ if freshness_values is not null and not coalesce(
  'FRESH'=any(freshness_values) and (item->>'updated_at')::timestamptz>=now()-interval '12 hours'
  or 'UPDATE_NEEDED'=any(freshness_values) and (item->>'updated_at')::timestamptz<now()-interval '12 hours',false) then return false;end if;$new$) loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'CAPACITY_PAYLOAD_FILTER_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $private_filters$;
notify pgrst,'reload schema';
commit;
