-- FEAT-CON-001. A registered identity may read existing personal email grants.
-- Keep the existing rich Capacity projection and its sharing-mode checks.
begin;
select pg_advisory_xact_lock(8030199);
set local lock_timeout='5s';
set local statement_timeout='30s';

create function public.account_capacity_filtered_page(
 actor_user_id uuid, recipient_digest text,
 cursor_updated_at timestamptz default null,cursor_id uuid default null,
 requested_page_size integer default 100,query jsonb default '{}'::jsonb
) returns table(payload jsonb)
language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare verified_email text;
begin
 select lower(trim(u.email)) into verified_email
 from auth.users u join public.profiles p on p.id=u.id and p.active
 where u.id=actor_user_id and u.email_confirmed_at is not null;
 if verified_email is null or recipient_digest is null
  or recipient_digest !~ '^[0-9a-f]{64}$' then
  raise exception 'ACCOUNT_CAPACITY_FORBIDDEN';
 end if;
 -- A digest provided by a service caller never authorizes another identity.
 -- The installed projection separately checks each grant, visibility, current
 -- vehicle/driver pair and current Capacity state on every read.
 if not exists (
  select 1 from public.capacity_access_grants g
  where g.audience_type='EMAIL' and lower(trim(g.recipient_email))=verified_email
   and g.recipient_email_digest=recipient_digest
   and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())
 ) then return;end if;
 return query select row.payload from public.private_capacity_filtered_page(
  'EMAIL',recipient_digest,null,cursor_updated_at,cursor_id,
  requested_page_size,query
 ) row;
end $$;

revoke all on function public.account_capacity_filtered_page(uuid,text,timestamptz,uuid,integer,jsonb)
 from public,anon,authenticated;
grant execute on function public.account_capacity_filtered_page(uuid,text,timestamptz,uuid,integer,jsonb)
 to service_role;
notify pgrst,'reload schema';
commit;
