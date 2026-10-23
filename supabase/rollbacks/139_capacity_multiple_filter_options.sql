-- Roll back the application first. Restore exact retained functions; no data rewrites.
begin;
select pg_advisory_xact_lock(8030139);
do $restore$
declare signature text;name text;backup_name text;definition text;
begin
 for signature,name,backup_name in values
  ('public.public_capacity_page_pre_filter_options(jsonb,timestamptz,uuid,integer)','public_capacity_page','public_capacity_page_pre_filter_options'),
  ('public.capacity_search_public_rows_pre_filter_options(jsonb,timestamptz,uuid,integer)','capacity_search_public_rows','capacity_search_public_rows_pre_filter_options'),
  ('public.capacity_payload_matches_pre_filter_options(jsonb,jsonb)','capacity_payload_matches','capacity_payload_matches_pre_filter_options') loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||backup_name||'(')<>1 then raise exception 'CAPACITY_FILTER_ROLLBACK_HEADER_DRIFT';end if;
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||backup_name||'(','CREATE OR REPLACE FUNCTION public.'||name||'(');
 end loop;
end $restore$;
drop function public.capacity_filter_values(text,text);
notify pgrst,'reload schema';
commit;
