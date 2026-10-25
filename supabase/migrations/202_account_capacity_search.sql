-- Profile search in Shared capacity must use the same authorized vehicle rows
-- as the account map. Keep the existing bounded 100-vehicle search window.
begin;
select pg_advisory_xact_lock(8030202);
set local lock_timeout='5s';
set local statement_timeout='30s';
create function public.account_capacity_search_results(
 actor_user_id uuid,recipient_digest text,query jsonb,requested_page integer default 1
) returns jsonb language plpgsql stable security definer
set search_path=public,extensions,pg_temp as $$
declare answer jsonb;page_number integer:=greatest(1,least(coalesce(requested_page,1),10000));
begin
 if query is null or jsonb_typeof(query)<>'object' or length(coalesce(query->>'q',''))>120
 then raise exception 'INVALID_SEARCH';end if;
 with capacity as materialized (
  select payload from public.account_capacity_filtered_page(
   actor_user_id,recipient_digest,null,null,100,query-'viewport')
 ),facts as materialized (
  select payload,public.capacity_search_metadata(payload) as meta from capacity
 ),entries as (
  select 'PROVIDER:'||(payload->>'provider_handle') as key,meta->>'kind' as kind,
   payload->>'provider_name' as title,meta->>'headline' as subtitle,
   concat_ws(' ',meta->>'about',meta->>'services') as description,
   payload->>'provider_handle' as identifier,payload->>'provider_handle' as handle,
   null::text as capacity_id,meta->>'city' as city,null::text as status,
   payload->>'provider_name' as owner,null::text as driver,
   meta->'owner_documents' as documents from facts
  union all
  select 'DRIVER:'||(meta->>'driver_key'),'COMPANY_DRIVER',meta->>'driver_name',
   payload->>'provider_name',null,null,payload->>'provider_handle',
   payload->>'id',meta->>'city',null,payload->>'provider_name',
   meta->>'driver_name',meta->'driver_documents' from facts
   where meta->>'kind'='COMPANY' and nullif(meta->>'driver_name','') is not null
 ),grouped as (
  select key,kind,title,subtitle,left(description,220) as description,identifier,
   handle,min(capacity_id) as capacity_id,city,status,owner,driver,documents,
   count(*) as matching_trucks,
   public.capacity_text_score(query->>'q',concat_ws(' ',title,identifier),
    concat_ws(' ',subtitle,description,city,owner,driver)) as score
  from entries
  group by key,kind,title,subtitle,description,identifier,handle,city,status,
   owner,driver,documents
 ),ordered as (
  select *,row_number() over(order by score desc,
   case kind when 'COMPANY' then 0 when 'OWNER_OPERATOR' then 1
    when 'SELF_MANAGED_DRIVER' then 2 else 4 end,lower(title),key) as position
  from grouped
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(to_jsonb(o)-'score'-'position' order by position)
   from ordered o where position>(page_number-1)*15 and position<=page_number*15),'[]'::jsonb),
  'total',(select count(*) from grouped),'page',page_number,'pageSize',15,
  'hasMore',(select count(*) from grouped)>page_number*15) into answer;
 return answer;
end $$;
revoke all on function public.account_capacity_search_results(uuid,text,jsonb,integer)
 from public,anon,authenticated;
grant execute on function public.account_capacity_search_results(uuid,text,jsonb,integer)
 to service_role;
alter function public.account_capacity_search_results(uuid,text,jsonb,integer) set jit=off;
notify pgrst,'reload schema';
commit;
