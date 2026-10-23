-- FEAT-PLY-001: bounded public reports; staff-only persisted moderation.
alter table public.organizations add column content_hidden boolean not null default false;
alter table public.provider_profiles add column content_hidden boolean not null default false;
create table public.content_reports (
 id uuid primary key default gen_random_uuid(),handle text not null,
 organization_id uuid references public.organizations(id),provider_profile_id uuid references public.provider_profiles(id),
 review_id uuid references public.provider_reviews(id),
 reporter_digest text not null check(reporter_digest ~ '^[a-f0-9]{64}$'),
 category text not null check(category in ('PROFILE','PICTURE','REVIEW','OTHER')),
 detail text not null check(length(trim(detail)) between 5 and 1000),
 status text not null default 'PENDING' check(status in ('PENDING','HIDDEN','DISMISSED','RESTORED')),
 previous_visibility text,previous_published boolean,
 created_at timestamptz not null default clock_timestamp(),reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id),decision_note text,
 check((organization_id is not null)<>(provider_profile_id is not null)),
 check(review_id is null or category='REVIEW')
);
create unique index content_report_one_pending on public.content_reports(reporter_digest,handle,category,coalesce(review_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status='PENDING';
alter table public.content_reports enable row level security;
revoke all on public.content_reports from public,anon,authenticated;
grant select,insert,update,delete on public.content_reports to service_role;
create function public.keep_moderated_content_private() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin if new.content_hidden then new.public_visibility:='PRIVATE';end if;return new;end $$;
create trigger moderated_organization before insert or update on public.organizations for each row execute function public.keep_moderated_content_private();
create trigger moderated_provider before insert or update on public.provider_profiles for each row execute function public.keep_moderated_content_private();
revoke all on function public.keep_moderated_content_private() from public,anon,authenticated;

create function public.submit_content_report(provider_handle text,visitor_digest text,report_category text,report_detail text,target_review_id uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid;provider uuid;result uuid;
begin
 if provider_handle is null or provider_handle !~ '^[a-z0-9][a-z0-9_-]{1,63}$' or visitor_digest is null or visitor_digest !~ '^[a-f0-9]{64}$'
 or report_category is null or report_category not in ('PROFILE','PICTURE','REVIEW','OTHER') or report_detail is null or length(trim(report_detail)) not between 5 and 1000 then raise exception 'INVALID_CONTENT_REPORT';end if;
 select id into org from organizations where handle=provider_handle and type='TRANSPORT_COMPANY' and public_visibility='PUBLIC' and not content_hidden;
 if org is null then select id into provider from provider_profiles where handle=provider_handle and public_visibility='PUBLIC' and not content_hidden;end if;
 if org is null and provider is null then raise exception 'NOT_FOUND';end if;
 if not exists(select 1 from company_pages c where c.published and(c.organization_id=org or c.provider_profile_id=provider)) then raise exception 'NOT_FOUND';end if;
 if target_review_id is not null and (report_category<>'REVIEW' or not exists(select 1 from provider_reviews where id=target_review_id and status='PUBLISHED'
 and(provider_organization_id=org or provider_profile_id=provider))) then raise exception 'NOT_FOUND';end if;
 insert into content_reports(handle,organization_id,provider_profile_id,review_id,reporter_digest,category,detail)
 values(provider_handle,org,provider,target_review_id,visitor_digest,report_category,trim(report_detail)) on conflict do nothing returning id into result;
 if result is null then select id into result from content_reports where reporter_digest=visitor_digest and handle=provider_handle and category=report_category and review_id is not distinct from target_review_id and status='PENDING';end if;
 return result;
end $$;
create function public.moderate_content_report(actor_user_id uuid,target_report_id uuid,decision text,note text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare r content_reports%rowtype;visibility text;published boolean;
begin
 if not managed_actor_has_permission(actor_user_id,'TRUST') then raise exception 'FORBIDDEN';end if;
 if decision is null or decision not in ('HIDE','DISMISS','RESTORE') or note is null or length(trim(note)) not between 5 and 1000 then raise exception 'INVALID_MODERATION';end if;
 select * into r from content_reports where id=target_report_id for update;if not found then raise exception 'NOT_FOUND';end if;
 if(decision in ('HIDE','DISMISS') and r.status<>'PENDING') or(decision='RESTORE' and r.status<>'HIDDEN') then raise exception 'REPORT_ALREADY_REVIEWED';end if;
 if decision='HIDE' and r.review_id is not null then
  update provider_reviews set status='REMOVED' where id=r.review_id;
 elsif decision='RESTORE' and r.review_id is not null then
  update provider_reviews set status='PUBLISHED' where id=r.review_id;
 elsif decision='HIDE' then
  if r.organization_id is not null then select public_visibility into visibility from organizations where id=r.organization_id for update;
  else select public_visibility into visibility from provider_profiles where id=r.provider_profile_id for update;end if;
  select c.published into published from company_pages c where c.organization_id=r.organization_id or c.provider_profile_id=r.provider_profile_id;
  if visibility='PRIVATE' then select coalesce(x.previous_visibility,visibility),coalesce(x.previous_published,published) into visibility,published from content_reports x
   where x.handle=r.handle and x.status='HIDDEN' and x.review_id is null order by x.reviewed_at limit 1;end if;
  update content_reports set previous_visibility=visibility,previous_published=published where id=r.id;
  update organizations set content_hidden=true where id=r.organization_id;
  update provider_profiles set content_hidden=true where id=r.provider_profile_id;
  update company_pages set published=false where organization_id=r.organization_id or provider_profile_id=r.provider_profile_id;
 elsif decision='RESTORE' and not exists(select 1 from content_reports x where x.handle=r.handle and x.status='HIDDEN' and x.review_id is null and x.id<>r.id) then
  update organizations set content_hidden=false,public_visibility=coalesce(r.previous_visibility,'PRIVATE') where id=r.organization_id;
  update provider_profiles set content_hidden=false,public_visibility=coalesce(r.previous_visibility,'PRIVATE') where id=r.provider_profile_id;
  update company_pages set published=coalesce(r.previous_published,false) where organization_id=r.organization_id or provider_profile_id=r.provider_profile_id;
 end if;
 update content_reports set status=case decision when 'HIDE' then 'HIDDEN' when 'RESTORE' then 'RESTORED' else 'DISMISSED' end,
 reviewed_at=clock_timestamp(),reviewed_by=actor_user_id,decision_note=trim(note) where id=r.id;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'CONTENT_REPORT_'||decision,'content_report',r.id,'{}');return true;
end $$;
revoke all on function public.submit_content_report(text,text,text,text,uuid),public.moderate_content_report(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_content_report(text,text,text,text,uuid),public.moderate_content_report(uuid,uuid,text,text) to service_role;

-- Apply viewer blocks before pagination/counting, preserving migration 130's
-- search/document optimization and all existing route/sharing predicates.
do $migration$
declare definition text;anchor text:=' if not (nullif(query->>''q'','''') is not null';
begin
 definition:=pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'CONTENT_BLOCK_SEARCH_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,E' if jsonb_typeof(query->''blocked_handles'')=''array'' and (query->''blocked_handles'') ? (item->>''provider_handle'') then return false;end if;\n'||anchor);
end $migration$;
notify pgrst,'reload schema';
