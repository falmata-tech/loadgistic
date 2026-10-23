-- FEAT-SHR-001: private contact labels; grant authority remains email-based.
alter table public.capacity_access_grants add column recipient_name text;
alter table public.capacity_access_grants add constraint capacity_contact_name_valid
 check (recipient_name is null or (audience_type='EMAIL' and
 length(btrim(recipient_name)) between 1 and 100 and recipient_name !~ '[[:cntrl:]]'));

create function public.name_private_capacity_contact(actor_user_id uuid,target_grant_id uuid,contact_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare contact public.capacity_access_grants%rowtype;
 clean_name text:=btrim(contact_name);
begin
 select * into contact from public.capacity_access_grants where id=target_grant_id;
 if not found or contact.audience_type<>'EMAIL' or contact.revoked_at is not null or
 not public.private_capacity_actor_controls_vehicle(actor_user_id,contact.vehicle_id) then raise exception 'NOT_FOUND'; end if;
 perform 1 from public.vehicles where id=contact.vehicle_id and active for update;
 select * into contact from public.capacity_access_grants where id=target_grant_id for update;
 if not found or contact.revoked_at is not null or
 not public.private_capacity_actor_controls_vehicle(actor_user_id,contact.vehicle_id) then raise exception 'NOT_FOUND'; end if;
 if clean_name is null or length(clean_name) not between 1 and 100 or clean_name ~ '[[:cntrl:]]' then raise exception 'CONTACT_NAME_REQUIRED'; end if;
 if contact.recipient_name is distinct from clean_name then
  update public.capacity_access_grants set recipient_name=clean_name where id=contact.id;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details)
  values(gen_random_uuid(),actor_user_id,'PRIVATE_CAPACITY_CONTACT_NAMED','capacity_access_grant',contact.id,
   jsonb_build_object('vehicleId',contact.vehicle_id));
 end if;
 return jsonb_build_object('id',contact.id,'recipient_name',clean_name);
end $$;

create function public.grant_named_private_capacity_access(actor_user_id uuid,target_vehicle_id uuid,
 normalized_recipient_email text,recipient_digest text,contact_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then raise exception 'NOT_FOUND'; end if;
 if contact_name is null or length(btrim(contact_name)) not between 1 and 100 or contact_name ~ '[[:cntrl:]]' then raise exception 'CONTACT_NAME_REQUIRED'; end if;
 result:=public.grant_private_capacity_access(actor_user_id,target_vehicle_id,normalized_recipient_email,recipient_digest);
 perform public.name_private_capacity_contact(actor_user_id,(result->>'id')::uuid,contact_name);
 return result || jsonb_build_object('recipient_name',btrim(contact_name));
end $$;
revoke all on function public.name_private_capacity_contact(uuid,uuid,text),
 public.grant_named_private_capacity_access(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.name_private_capacity_contact(uuid,uuid,text),
 public.grant_named_private_capacity_access(uuid,uuid,text,text,text) to service_role;

-- Extend only already-authorized management projections, never visitor data.
do $$
declare signature text; definition text; before_text text; after_text text;
begin
 signature:='private_capacity_network(uuid)';
 before_text:=$before$'recipient_email',grant_record.recipient_email,$before$;
 after_text:=$after$'recipient_email',grant_record.recipient_email,'recipient_name',grant_record.recipient_name,$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'CONTACT_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);

 signature:='provider_capacity_workspace(uuid)';
 before_text:=$before$'sharing_mode',public.capacity_sharing_mode(capacity.vehicle_id),$before$;
 after_text:=$after$'sharing_mode',public.capacity_sharing_mode(capacity.vehicle_id),'exclusive_name',(select g.recipient_name from public.capacity_access_grants g join public.vehicle_capacity_sharing p on p.vehicle_id=g.vehicle_id where g.vehicle_id=capacity.vehicle_id and g.audience_type='EMAIL' and g.recipient_email_digest=p.exclusive_digest and g.revoked_at is null),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'CONTACT_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);

 -- New clients include the name; older commands preserve labels and authority.
 -- Any invalid name raises within publication's transaction (including mode/grant).
 signature:='publish_provider_capacity(uuid,jsonb)';
 before_text:=$before$perform public.set_provider_capacity_sharing(actor_user_id,vehicle.id,command->>'sharing_mode',command->>'exclusive_email',command->>'exclusive_digest');$before$;
 after_text:=$after$perform public.set_provider_capacity_sharing(actor_user_id,vehicle.id,command->>'sharing_mode',command->>'exclusive_email',command->>'exclusive_digest');
    if command->>'sharing_mode'='EXCLUSIVE' and command ? 'exclusive_name' then
      perform public.grant_named_private_capacity_access(actor_user_id,vehicle.id,command->>'exclusive_email',command->>'exclusive_digest',command->>'exclusive_name');
    end if;$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'CONTACT_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
end $$;
alter table public.platform_controls add column capacity_contact_names boolean not null default true check(capacity_contact_names);
notify pgrst,'reload schema';
