-- FEAT-CON-001: private Capacity belongs to registered shipper/broker accounts.
-- Demo email Capacity access is retired; registered accounts are the only recipients.
begin;
select pg_advisory_xact_lock(8030207);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $account$
declare definition text;old_branch text;new_branch text;
begin
 definition:=pg_get_functiondef('public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)'::regprocedure);
 old_branch:=$old$    where public.account_capacity_grant_valid(grant_record.id)
    union
    select grant_record.vehicle_id from public.capacity_access_grants grant_record
    join auth.users recipient on recipient.id=actor_user_id and recipient.email_confirmed_at is not null
      and lower(trim(recipient.email))=grant_record.recipient_email
    where grant_record.audience_type='EMAIL' and grant_record.recipient_email_digest=requested_digest
      and grant_record.revoked_at is null and(grant_record.expires_at is null or grant_record.expires_at>now())
      and public.capacity_sharing_allows(grant_record.vehicle_id,'EMAIL',requested_digest)
      and public.business_vehicle_review_scope(grant_record.vehicle_id)=public.business_review_identity(actor_user_id)$old$;
 new_branch:=$new$    where grant_record.recipient_kind='BUSINESS'
      and public.account_capacity_grant_valid(grant_record.id)$new$;
 if (length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1
 then raise exception 'ACCOUNT_ONLY_PROJECTION_DRIFT';end if;
 execute replace(definition,old_branch,new_branch);
end $account$;

do $business$
declare definition text;old_branch text;
begin
 definition:=pg_get_functiondef('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 old_branch:=$old$      union all
      select g.vehicle_id,false as team_share from public.capacity_access_grants g
      join auth.users u on u.id=actor_user_id and u.email_confirmed_at is not null
       and lower(trim(u.email))=g.recipient_email
      where g.audience_type='EMAIL' and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())
       and public.business_workspace_permission(actor_user_id,target_workspace_id,'CAPACITY')
       and public.capacity_sharing_allows(g.vehicle_id,'EMAIL',g.recipient_email_digest)
       and public.business_vehicle_review_scope(g.vehicle_id)=public.business_review_identity(actor_user_id)
$old$;
 if (length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1
 then raise exception 'BUSINESS_ONLY_PROJECTION_DRIFT';end if;
 execute replace(definition,old_branch,'');
end $business$;

do $grant$
declare definition text;old_branch text;new_branch text;
begin
 definition:=pg_get_functiondef('public.grant_account_capacity_access(uuid,uuid,uuid)'::regprocedure);
 old_branch:=$old$ else raise exception 'DIRECTORY_FORBIDDEN';end if;
 perform 1 from vehicles where id=target_vehicle_id and active for update;$old$;
 new_branch:=$new$ else raise exception 'DIRECTORY_FORBIDDEN';end if;
 if recipient_kind<>'BUSINESS' then raise exception 'DIRECTORY_FORBIDDEN';end if;
 perform 1 from vehicles where id=target_vehicle_id and active for update;$new$;
 if (length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1
 then raise exception 'BUSINESS_RECIPIENT_GRANT_DRIFT';end if;
 execute replace(definition,old_branch,new_branch);
end $grant$;

create function public.reject_new_email_capacity_grant() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.audience_type='EMAIL' and new.revoked_at is null then
  if tg_op='INSERT' then raise exception 'EMAIL_CAPACITY_RETIRED';end if;
  if old.revoked_at is not null
   or new.vehicle_id is distinct from old.vehicle_id
   or new.recipient_email_digest is distinct from old.recipient_email_digest
  then raise exception 'EMAIL_CAPACITY_RETIRED';end if;
 end if;
 return new;
end $$;
create trigger reject_new_email_capacity_grant
 before insert or update on public.capacity_access_grants
 for each row execute function public.reject_new_email_capacity_grant();
revoke all on function public.reject_new_email_capacity_grant() from public,anon,authenticated;

create function public.reject_exclusive_email_capacity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.mode='EXCLUSIVE' then raise exception 'EMAIL_CAPACITY_RETIRED';end if;
 return new;
end $$;
create trigger reject_exclusive_email_capacity
 before insert or update on public.vehicle_capacity_sharing
 for each row execute function public.reject_exclusive_email_capacity();
revoke all on function public.reject_exclusive_email_capacity() from public,anon,authenticated;

-- The legacy projections still exist for historical compatibility. Make their
-- shared policy helper deny EMAIL even if an operator later imports old rows.
create or replace function public.capacity_sharing_allows(target_vehicle_id uuid,audience text,recipient_digest text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select upper(audience)<>'EMAIL' and exists(
  select 1 from public.vehicles v left join public.vehicle_capacity_sharing p on p.vehicle_id=v.id
  where v.id=target_vehicle_id and v.active
   and coalesce(p.mode,'PRIVATE') in ('PRIVATE','BOTH')
 )
$$;
revoke all on function public.capacity_sharing_allows(uuid,text,text) from public,anon,authenticated;

-- Play review users sign in as accounts too. Their historical visitor digest
-- cannot open the retired email Capacity route; Tracking remains independent.
create or replace function public.native_review_visitor_digest(actor_user_id uuid,requested_scope text)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare review_row public.app_review_accounts%rowtype;result text;
begin
 if requested_scope<>'tracking' or not public.native_review_account_allowed(actor_user_id)
 then return null;end if;
 select * into review_row from public.app_review_accounts where user_id=actor_user_id;
 result:=review_row.tracking_digest;
 if result is null or exists(
  select 1 from public.provider_tracking_recipients recipient
  join public.provider_shipments shipment on shipment.id=recipient.shipment_id
  where recipient.recipient_email_digest=result
   and not(coalesce(shipment.provider_organization_id=review_row.organization_id,false)
    or coalesce(shipment.provider_profile_id=review_row.provider_profile_id,false))
 ) then return null;end if;
 return result;
end $$;
revoke all on function public.native_review_visitor_digest(uuid,text) from public,anon,authenticated;

-- Remove disposable email-only access data. Tracking deliveries use a separate
-- delivery kind and are deliberately left alone.
delete from public.access_email_deliveries where delivery_kind='SHARED_CAPACITY';
delete from public.shared_capacity_email_otps;
delete from public.capacity_access_grants where audience_type='EMAIL';
alter table public.access_email_deliveries add constraint access_email_no_shared_capacity
 check (delivery_kind<>'SHARED_CAPACITY');
alter table public.shared_capacity_email_otps add constraint shared_capacity_otp_retired
 check (false);
alter table public.capacity_access_grants add constraint capacity_access_no_email
 check (audience_type<>'EMAIL');

notify pgrst,'reload schema';
commit;
