-- FEAT-FTR-001 / FEAT-IAM-001 / ADR-054. Public consent is explicit; metadata is private.
create table public.driver_portrait_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  file_path text not null unique check(file_path ~ '^supabase://provider-profile/driver-portrait/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}\.jpg$'),
  size_bytes integer not null check(size_bytes between 1 and 4194304),
  state text not null default 'PENDING' check(state in ('PENDING','ACTIVE','RETIRED','DELETING')),
  upload_finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index driver_portrait_one_active on public.driver_portrait_uploads(user_id) where state='ACTIVE';
create index driver_portrait_cleanup on public.driver_portrait_uploads(state,updated_at);
alter table public.driver_portrait_uploads enable row level security;
revoke all on public.driver_portrait_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.driver_portrait_uploads to service_role;

create function public.driver_portrait_workspace(actor_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor profiles%rowtype;
begin
  select * into actor from profiles where id=actor_user_id and active and role='DRIVER';
  if not found then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object('public_id',(select id from driver_portrait_uploads where user_id=actor.id and state='ACTIVE'),
    'preset',actor.driver_portrait_preset);
end $$;

create function public.reserve_driver_portrait(actor_user_id uuid,storage_reference text,file_size integer) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare upload_id uuid;
begin
  perform 1 from profiles where id=actor_user_id and active and role='DRIVER' for update;
  if not found then raise exception 'FORBIDDEN';end if;
  if (select count(*) from driver_portrait_uploads where user_id=actor_user_id and state='PENDING')>=5 then raise exception 'PORTRAIT_UPLOAD_BUSY';end if;
  insert into driver_portrait_uploads(user_id,file_path,size_bytes) values(actor_user_id,storage_reference,file_size) returning id into upload_id;
  return upload_id;
end $$;

create function public.activate_driver_portrait(actor_user_id uuid,upload_id uuid,public_consent boolean) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare upload driver_portrait_uploads%rowtype;
begin
  perform 1 from profiles where id=actor_user_id and active and role='DRIVER' for update;
  if not found then raise exception 'FORBIDDEN';end if;
  if public_consent is distinct from true then raise exception 'PORTRAIT_CONSENT_REQUIRED';end if;
  select * into upload from driver_portrait_uploads where id=upload_id and user_id=actor_user_id for update;
  if not found or upload.state not in ('PENDING','ACTIVE') then raise exception 'NOT_FOUND';end if;
  if upload.state='ACTIVE' then return true;end if;
  update driver_portrait_uploads set state='RETIRED',updated_at=now() where user_id=actor_user_id and state='ACTIVE';
  update driver_portrait_uploads set state='ACTIVE',upload_finished=true,updated_at=now() where id=upload.id;
  update profiles set driver_portrait_preset=null where id=actor_user_id;
  insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(actor_user_id,'DRIVER_PORTRAIT_UPDATED','profile',actor_user_id,'{}');
  return true;
end $$;

create function public.remove_driver_portrait(actor_user_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from profiles where id=actor_user_id and active and role='DRIVER' for update;
  if not found then raise exception 'FORBIDDEN';end if;
  update driver_portrait_uploads set state='RETIRED',updated_at=now() where user_id=actor_user_id and state in ('ACTIVE','PENDING');
  update profiles set driver_portrait_preset=null where id=actor_user_id;
  insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(actor_user_id,'DRIVER_PORTRAIT_REMOVED','profile',actor_user_id,'{}');
  return true;
end $$;

-- A lost activation response must never cause deletion of an ACTIVE image.
create function public.discard_pending_driver_portrait(actor_user_id uuid,upload_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update driver_portrait_uploads set state='RETIRED',upload_finished=true,updated_at=now()
    where id=upload_id and user_id=actor_user_id and state in ('PENDING','RETIRED');
  return found;
end $$;

create function public.public_driver_portrait_file(portrait_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('file_path',image.file_path,'mime_type','image/jpeg')
  from driver_portrait_uploads image join profiles actor on actor.id=image.user_id
  where image.id=portrait_id and image.state='ACTIVE' and actor.active and actor.role='DRIVER'
$$;

create function public.claim_driver_portrait_cleanup(requested_limit integer default 20) returns table(id uuid,file_path text)
language sql security definer set search_path=public,pg_temp as $$
  with candidates as (
    select image.id from driver_portrait_uploads image
    where (image.state='RETIRED' and (image.upload_finished or image.updated_at<now()-interval '1 hour'))
      or (image.state='PENDING' and image.updated_at<now()-interval '1 hour')
      or (image.state='DELETING' and image.updated_at<now()-interval '5 minutes')
    order by image.updated_at,image.id for update skip locked limit greatest(1,least(coalesce(requested_limit,20),20))
  )
  update driver_portrait_uploads image set state='DELETING',updated_at=now()
  from candidates where image.id=candidates.id returning image.id,image.file_path
$$;

revoke all on function public.driver_portrait_workspace(uuid), public.reserve_driver_portrait(uuid,text,integer),
  public.activate_driver_portrait(uuid,uuid,boolean),public.remove_driver_portrait(uuid),
  public.discard_pending_driver_portrait(uuid,uuid),public.public_driver_portrait_file(uuid),
  public.claim_driver_portrait_cleanup(integer) from public,anon,authenticated;
grant execute on function public.driver_portrait_workspace(uuid), public.reserve_driver_portrait(uuid,text,integer),
  public.activate_driver_portrait(uuid,uuid,boolean),public.remove_driver_portrait(uuid),
  public.discard_pending_driver_portrait(uuid,uuid),public.public_driver_portrait_file(uuid),
  public.claim_driver_portrait_cleanup(integer) to service_role;
