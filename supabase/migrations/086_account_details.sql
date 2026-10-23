-- FEAT-IAM-001 / FEAT-FLT-001: self-only account edits, separate private phones.
-- Service actor comes only from validated Auth. No target-id or authority fields.
create function public.update_own_account_details(actor_user_id uuid,command jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare actor profiles%rowtype; name_value text; phone_value text;
begin
  -- Use the same driver -> profile row order as fleet contact editing.
  perform 1 from drivers where user_id=actor_user_id for update;
  select * into actor from profiles where id=actor_user_id for update;
  if not found or not actor.active or actor.role not in ('TRANSPORTER','DRIVER','ADMIN') then
    raise exception 'FORBIDDEN';
  end if;
  if command is null or jsonb_typeof(command) is distinct from 'object' then
    raise exception 'INVALID_ACCOUNT_DETAILS';
  end if;
  if (command - array['name','phone'])<>'{}'::jsonb
    or jsonb_typeof(command->'name') is distinct from 'string'
    or jsonb_typeof(command->'phone') is distinct from 'string' then
    raise exception 'INVALID_ACCOUNT_DETAILS';
  end if;
  name_value:=btrim(command->>'name',E' \t\n\r\f'||chr(11));
  phone_value:=btrim(command->>'phone',E' \t\n\r\f'||chr(11));
  if char_length(name_value) not between 2 and 100 or name_value ~ '[[:cntrl:]]'
    or char_length(phone_value)>32 or (phone_value<>'' and (
      phone_value !~ '^\+?[0-9 ()-]+$' or char_length(regexp_replace(phone_value,'[^0-9]','','g'))<7)) then
    raise exception 'INVALID_ACCOUNT_DETAILS';
  end if;
  update profiles set full_name=name_value,phone=nullif(phone_value,'') where id=actor.id;
  update drivers set name=name_value where user_id=actor.id and active;
  insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(actor.id,'ACCOUNT_DETAILS_UPDATED','profile',actor.id,'{}');
  return true;
end $$;
revoke all on function public.update_own_account_details(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_own_account_details(uuid,jsonb) to service_role;

-- Preserve the reviewed owner/tenant command; only remove its private-phone write.
create or replace function public.fleet_update_driver_contact(actor_user_id uuid,command jsonb) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); driver_id uuid:=(command->>'driver_user_id')::uuid;
  name_value text:=trim(coalesce(command->>'name','')); phone_value text:=trim(coalesce(command->>'phone',''));
begin
  perform 1 from organizations where id=org for update;
  if char_length(name_value) not between 2 and 100 or char_length(phone_value) not between 7 and 32
    or phone_value !~ '^\+?[0-9 ()-]+$' then raise exception 'INVALID_DRIVER_CONTACT'; end if;
  if not exists(select 1 from drivers d join organization_members m on m.user_id=d.user_id and m.organization_id=d.organization_id
    join profiles p on p.id=d.user_id and p.active and p.role='DRIVER'
    where d.user_id=driver_id and d.organization_id=org and d.active) then raise exception 'NOT_FOUND'; end if;
  update drivers set name=name_value,phone=phone_value where user_id=driver_id;
  update profiles set full_name=name_value where id=driver_id;
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,org,'DRIVER_CONTACT_UPDATED','driver',driver_id,'{}');
  return true;
end $$;
