-- FEAT-PLY-001: close alternate public projections and freeze erasure scope.
do $migration$
declare definition text;anchor text:='candidate.page_published and candidate.has_public_contact';
begin
 definition:=pg_get_functiondef('public.public_featured_provider_candidates(text[])'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'FEATURED_POLICY_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,anchor||E'\n      and not exists(select 1 from public.organizations x where x.id=candidate.provider_organization_id and (x.content_hidden or x.review_workspace))\n      and not exists(select 1 from public.provider_profiles x where x.id=candidate.provider_profile_id and (x.content_hidden or x.review_workspace))');
end $migration$;
create or replace function public.public_driver_portrait_file(portrait_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('file_path',image.file_path,'mime_type','image/jpeg')
 from driver_portrait_uploads image join profiles actor on actor.id=image.user_id
 where image.id=portrait_id and image.state='ACTIVE' and actor.active and actor.role='DRIVER'
 and not exists(select 1 from provider_profiles p where p.user_id=actor.id and(p.content_hidden or p.review_workspace))
 and not exists(select 1 from organization_members m join organizations o on o.id=m.organization_id
 where m.user_id=actor.id and(o.content_hidden or o.review_workspace))
$$;

create function public.account_erasure_locked(target_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from account_deletion_requests where subject_user_id=target_user_id and status in ('ERASING','COMPLETED'))
$$;
create function public.keep_account_erasure_scope() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare before_row jsonb;after_row jsonb;item jsonb;org_id uuid;provider_id uuid;
begin
 if tg_op<>'INSERT' then before_row:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then after_row:=to_jsonb(new);end if;
 if tg_table_name='profiles' then
  if account_erasure_locked(old.id) and(new.active or new.role<>old.role) then raise exception 'ACCOUNT_ERASURE_IN_PROGRESS';end if;
 elsif tg_table_name='organization_members' then
  for item in select v from unnest(array[before_row,after_row]) v where v is not null loop
   if account_erasure_locked((item->>'user_id')::uuid) or exists(select 1 from organization_members m
    where m.organization_id=(item->>'organization_id')::uuid and m.membership_role='OWNER' and account_erasure_locked(m.user_id)) then raise exception 'ACCOUNT_ERASURE_IN_PROGRESS';end if;
  end loop;
 elsif tg_table_name='provider_profiles' then
  if tg_op='INSERT' or tg_op='DELETE' or before_row->>'user_id' is distinct from after_row->>'user_id' then
   if account_erasure_locked((before_row->>'user_id')::uuid) or account_erasure_locked((after_row->>'user_id')::uuid) then raise exception 'ACCOUNT_ERASURE_IN_PROGRESS';end if;
  end if;
 elsif tg_table_name='vehicles' then
  if tg_op='INSERT' or tg_op='DELETE' or before_row->>'organization_id' is distinct from after_row->>'organization_id'
   or before_row->>'provider_profile_id' is distinct from after_row->>'provider_profile_id' then
   for item in select v from unnest(array[before_row,after_row]) v where v is not null loop
    org_id:=(item->>'organization_id')::uuid;provider_id:=(item->>'provider_profile_id')::uuid;
    if exists(select 1 from organization_members m where m.organization_id=org_id and m.membership_role='OWNER' and account_erasure_locked(m.user_id))
     or exists(select 1 from provider_profiles p where p.id=provider_id and account_erasure_locked(p.user_id)) then raise exception 'ACCOUNT_ERASURE_IN_PROGRESS';end if;
   end loop;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger erasure_profile before update on public.profiles for each row execute function public.keep_account_erasure_scope();
create trigger erasure_members before insert or update or delete on public.organization_members for each row execute function public.keep_account_erasure_scope();
create trigger erasure_provider before insert or update or delete on public.provider_profiles for each row execute function public.keep_account_erasure_scope();
create trigger erasure_vehicle before insert or update or delete on public.vehicles for each row execute function public.keep_account_erasure_scope();
revoke all on function public.account_erasure_locked(uuid),public.keep_account_erasure_scope() from public,anon,authenticated;

do $migration$
declare definition text;anchor text:='or exists(select 1 from support_attachments x join support_conversations c';
begin
 definition:=pg_get_functiondef('public.prepare_account_erasure(uuid,uuid)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'ERASURE_SHARED_FILE_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,E'or exists(select 1 from payment_proofs x join subscriptions s on s.id=x.subscription_id where x.file_path=f.storage_path and not(coalesce(s.organization_id=any(orgs),false) or coalesce(s.provider_profile_id=any(providers),false)))\n '||anchor);
end $migration$;

-- Synthetic guest access uses an unrelated random digest, never the reviewer's
-- real email digest. Every use rechecks its workspace and denies a foreign grant.
alter table public.app_review_accounts add column tracking_digest text unique check(tracking_digest ~ '^[a-f0-9]{64}$');
alter table public.app_review_accounts add column capacity_digest text unique check(capacity_digest ~ '^[a-f0-9]{64}$');
create function public.native_review_visitor_digest(actor_user_id uuid,requested_scope text) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r app_review_accounts%rowtype;result text;
begin
 if not native_review_account_allowed(actor_user_id) then return null;end if;
 select * into r from app_review_accounts where user_id=actor_user_id;
 if requested_scope='tracking' then
  result:=r.tracking_digest;
  if result is null or exists(select 1 from provider_tracking_recipients p join provider_shipments s on s.id=p.shipment_id
   where p.recipient_email_digest=result and not(coalesce(s.provider_organization_id=r.organization_id,false) or coalesce(s.provider_profile_id=r.provider_profile_id,false))) then return null;end if;
 elsif requested_scope='capacity' then
  result:=r.capacity_digest;
  if result is null or exists(select 1 from capacity_access_grants g join vehicles v on v.id=g.vehicle_id
   where g.recipient_email_digest=result and not(coalesce(v.organization_id=r.organization_id,false) or coalesce(v.provider_profile_id=r.provider_profile_id,false))) then return null;end if;
 else return null;end if;
 return result;
end $$;
revoke all on function public.native_review_visitor_digest(uuid,text),public.public_driver_portrait_file(uuid) from public,anon,authenticated;
grant execute on function public.native_review_visitor_digest(uuid,text),public.public_driver_portrait_file(uuid) to service_role;
notify pgrst,'reload schema';
