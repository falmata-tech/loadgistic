-- FEAT-MKT-001 / NR-08/13: preserve matching and UI while avoiding unused work.
-- No relation, extension, public grant or new function signature.
do $migration$
declare definition text;start_at integer;end_at integer;document_block text;anchor text;
begin
 definition:=pg_get_functiondef('public.capacity_search_metadata(jsonb)'::regprocedure);
 start_at:=strpos(definition,' select coalesce(jsonb_agg(distinct r.verification_type)');
 end_at:=strpos(definition,' kind:=case when org is not null');
 if start_at=0 or end_at<=start_at then raise exception 'SEARCH_METADATA_DOCUMENT_BLOCK_DRIFT';end if;
 document_block:=substring(definition from start_at for end_at-start_at);
 if (length(document_block)-length(replace(document_block,'into owner_docs','')))/length('into owner_docs')<>1
 or (length(document_block)-length(replace(document_block,'into driver_docs','')))/length('into driver_docs')<>1
 or (length(document_block)-length(replace(document_block,'into truck_docs','')))/length('into truck_docs')<>1
 then raise exception 'SEARCH_METADATA_DOCUMENT_QUERIES_DRIFT';end if;
 definition:=left(definition,start_at-1)||E' owner_docs:=''[]''::jsonb;driver_docs:=''[]''::jsonb;truck_docs:=''[]''::jsonb;\n if coalesce((item->>''_search_documents_required'')::boolean,true) then\n'||document_block||E' end if;\n'||substring(definition from end_at);
 execute definition;
 definition:=pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure);
 anchor:='meta:=public.capacity_search_metadata(item);';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'SEARCH_MATCH_METADATA_CALL_DRIFT';end if;
 execute replace(definition,anchor,$body$meta:=public.capacity_search_metadata(item||jsonb_build_object('_search_documents_required',
 nullif(query->>'owner_docs','') is not null or nullif(query->>'driver_docs','') is not null or nullif(query->>'truck_docs','') is not null));$body$);
end $migration$;
notify pgrst,'reload schema';
