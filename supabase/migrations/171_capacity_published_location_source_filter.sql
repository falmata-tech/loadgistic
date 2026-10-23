-- FEAT-MKT-001 / FEAT-CAP-001: filter by the source of the published, already
-- obscured capacity position. Do not read device assignments or raw telemetry.
begin;
select pg_advisory_xact_lock(8030171);

-- Retain the installed definitions for an exact, reviewed rollback. A drifted
-- function stops the migration rather than silently replacing newer policy.
do $backups$
declare signature text;name text;backup_name text;definition text;
begin
 for signature,name,backup_name in values
  ('public.capacity_filter_values(text,text)','capacity_filter_values','capacity_filter_values_pre_source171'),
  ('public.capacity_search_matches(jsonb,jsonb)','capacity_search_matches','capacity_search_matches_pre_source171'),
  ('public.capacity_payload_matches(jsonb,jsonb)','capacity_payload_matches','capacity_payload_matches_pre_source171') loop
  if to_regprocedure('public.'||backup_name||'('||case when name='capacity_filter_values' then 'text,text' else 'jsonb,jsonb' end||')') is not null
   then raise exception 'CAPACITY_SOURCE_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(')<>1 then raise exception 'CAPACITY_SOURCE_HEADER_DRIFT: %',name;end if;
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||backup_name||'(');
 end loop;
end $backups$;
revoke all on function public.capacity_filter_values_pre_source171(text,text),
 public.capacity_search_matches_pre_source171(jsonb,jsonb),public.capacity_payload_matches_pre_source171(jsonb,jsonb)
 from public,anon,authenticated,service_role;

do $source_values$
declare definition text:=pg_get_functiondef('public.capacity_filter_values(text,text)'::regprocedure);
 anchor text:=$a$when 'freshness' then array['FRESH','UPDATE_NEEDED']$a$;
begin
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  or strpos(definition,'when ''location_source''')>0 then raise exception 'CAPACITY_SOURCE_VALIDATOR_DRIFT';end if;
 execute replace(definition,anchor,anchor||E'\n  when ''location_source'' then array[''GPS'',''MOBILE'',''MANUAL'']');
end $source_values$;

create function public.capacity_published_source_matches(item jsonb,query jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare selected text[]:=public.capacity_filter_values(query->>'location_source','location_source');
 published text;
begin
 if selected is null then return true;end if;
 published:=case item->>'location_source'
  when 'TELEMATICS' then 'GPS'
  when 'DEVICE_OBSCURED' then 'MOBILE'
  when 'MANUAL_ADMIN' then 'MANUAL'
  else null end;
 return coalesce(published=any(selected),false);
end $$;
revoke all on function public.capacity_published_source_matches(jsonb,jsonb) from public,anon,authenticated,service_role;

do $source_predicates$
declare definition text;signature text;anchor text;replacement text;
begin
 for signature,anchor,replacement in values
  ('public.capacity_search_matches(jsonb,jsonb)',
   $a$begin
 if jsonb_typeof(query->'blocked_handles')$a$,
   $b$begin
 if not public.capacity_published_source_matches(item,query) then return false;end if;
 if jsonb_typeof(query->'blocked_handles')$b$),
  ('public.capacity_payload_matches(jsonb,jsonb)',
   $a$begin
 if nullif(query->>'capacity_id','')$a$,
   $b$begin
 if not public.capacity_published_source_matches(item,query) then return false;end if;
 if nullif(query->>'capacity_id','')$b$) loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
   then raise exception 'CAPACITY_SOURCE_PREDICATE_DRIFT: %',signature;end if;
  execute replace(definition,anchor,replacement);
 end loop;
end $source_predicates$;

-- The existing public pages call capacity_search_matches before cursor paging.
-- Private email and business-workspace pages call capacity_payload_matches.
notify pgrst,'reload schema';
commit;
