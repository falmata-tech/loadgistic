-- FEAT-PLY-001: owner-provisioned synthetic review workspaces, no general bypass.
alter table public.organizations add column review_workspace boolean not null default false;
alter table public.provider_profiles add column review_workspace boolean not null default false;
create table public.app_review_accounts(
 user_id uuid primary key references public.profiles(id),
 organization_id uuid references public.organizations(id),provider_profile_id uuid references public.provider_profiles(id),
 expected_role text not null check(expected_role in ('DRIVER','TRANSPORTER')),
 enabled boolean not null default true,created_at timestamptz not null default clock_timestamp(),
 check((organization_id is not null)<>(provider_profile_id is not null))
);
alter table public.app_review_accounts enable row level security;
revoke all on public.app_review_accounts from public,anon,authenticated;
grant select,insert,update,delete on public.app_review_accounts to service_role;
create function public.native_review_account_allowed(actor_user_id uuid) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r app_review_accounts%rowtype;
begin
 select * into r from app_review_accounts where user_id=actor_user_id and enabled;if not found then return false;end if;
 if not exists(select 1 from profiles where id=r.user_id and active and role::text=r.expected_role) then return false;end if;
 if r.provider_profile_id is not null then
  return exists(select 1 from provider_profiles where id=r.provider_profile_id and user_id=r.user_id and review_workspace and public_visibility='PRIVATE');
 end if;
 if not exists(select 1 from organizations where id=r.organization_id and review_workspace and public_visibility='PRIVATE') then return false;end if;
 if not exists(select 1 from organization_members where user_id=r.user_id and organization_id=r.organization_id and(r.expected_role='DRIVER' or membership_role='OWNER')) then return false;end if;
 return not exists(select 1 from organization_members m where m.organization_id=r.organization_id
 and not exists(select 1 from app_review_accounts a where a.user_id=m.user_id and a.organization_id=r.organization_id and a.enabled));
end $$;
revoke all on function public.native_review_account_allowed(uuid) from public,anon,authenticated;
grant execute on function public.native_review_account_allowed(uuid) to service_role;
create or replace function public.keep_moderated_content_private() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin if new.content_hidden or new.review_workspace then new.public_visibility:='PRIVATE';end if;return new;end $$;
revoke all on function public.keep_moderated_content_private() from public,anon,authenticated;
create function public.keep_review_members_scoped() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from organizations where id=new.organization_id and review_workspace)
 and not exists(select 1 from app_review_accounts where user_id=new.user_id and organization_id=new.organization_id) then raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 return new;
end $$;
create trigger scoped_review_members before insert or update on public.organization_members for each row execute function public.keep_review_members_scoped();
revoke all on function public.keep_review_members_scoped() from public,anon,authenticated;
notify pgrst,'reload schema';
