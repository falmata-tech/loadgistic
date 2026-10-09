-- FEAT-PLY-001: explicit, versioned terms before user-content writes.
create table public.user_policy_acceptances(
 user_id uuid primary key references public.profiles(id) on delete cascade,version text not null,
 accepted_at timestamptz not null default clock_timestamp()
);
alter table public.user_policy_acceptances enable row level security;
revoke all on public.user_policy_acceptances from public,anon,authenticated;
grant select,insert,update,delete on public.user_policy_acceptances to service_role;
create function public.content_policy_accepted(actor_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from profiles where id=actor_user_id and active and role in ('ADMIN','SUPPORT'))
 or exists(select 1 from user_policy_acceptances where user_id=actor_user_id and version='2026-10-09')
$$;
create function public.accept_content_policy(actor_user_id uuid,policy_version text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if policy_version is distinct from '2026-10-09' then raise exception 'POLICY_VERSION_CHANGED';end if;
 if not exists(select 1 from profiles p join auth.users a on a.id=p.id where p.id=actor_user_id and p.role in ('TRANSPORTER','DRIVER')
 and a.email_confirmed_at is not null and a.deleted_at is null) then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from user_policy_acceptances where user_id=actor_user_id and version=policy_version) then return true;end if;
 insert into user_policy_acceptances(user_id,version) values(actor_user_id,policy_version)
 on conflict(user_id) do update set version=excluded.version,accepted_at=clock_timestamp();
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details) values(actor_user_id,'CONTENT_POLICY_ACCEPTED','profile',actor_user_id,jsonb_build_object('version',policy_version));return true;
end $$;
create function public.require_content_policy(actor_user_id uuid) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role in ('ADMIN','SUPPORT','TRANSPORTER','DRIVER')) then raise exception 'FORBIDDEN';end if;
 if not content_policy_accepted(actor_user_id) then raise exception 'POLICY_REQUIRED';end if;
end $$;
revoke all on function public.content_policy_accepted(uuid),public.accept_content_policy(uuid,text),public.require_content_policy(uuid) from public,anon,authenticated;
grant execute on function public.content_policy_accepted(uuid),public.accept_content_policy(uuid,text),public.require_content_policy(uuid) to service_role;
-- Preserve the actual latest command bodies and deny before content persistence.
do $migration$
declare signature text;definition text;offset_at integer;
begin
 foreach signature in array array[
 'public.update_provider_profile_page(uuid,jsonb)',
 'public.update_provider_profile_image(uuid,text,text,integer)',
 'public.update_own_account_details(uuid,jsonb)',
 'public.reserve_driver_portrait(uuid,text,integer)',
 'public.activate_driver_portrait(uuid,uuid,boolean)',
 'public.publish_provider_capacity(uuid,jsonb)'
 ] loop
 definition:=pg_get_functiondef(signature::regprocedure);
 offset_at:=strpos(lower(definition),E'\nbegin\n');
 if offset_at=0 then raise exception 'POLICY_COMMAND_BODY_DRIFT: %',signature;end if;
 definition:=left(definition,offset_at+6)||E' perform public.require_content_policy(actor_user_id);\n'||substring(definition from offset_at+7);
 execute definition;
 end loop;
end $migration$;
notify pgrst,'reload schema';
