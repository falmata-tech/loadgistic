-- FEAT-ADM-001: bounded Customers corrections and Operations map, no impersonation.
create function public.correct_admin_workspace(actor_user_id uuid,target_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare kind text:=command->>'kind'; name_value text:=trim(coalesce(command->>'name','')); old_name text; reason text:=trim(coalesce(command->>'reason',''));
begin
 if not managed_actor_has_permission(actor_user_id,'CUSTOMERS') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(command)<>'object' or char_length(name_value) not between 2 and 120 or name_value~'[[:cntrl:]]'
  or char_length(reason) not between 5 and 500 or kind is null or kind not in ('ORGANIZATION','PROVIDER_PROFILE')
  or exists(select 1 from jsonb_object_keys(command) k where k not in ('kind','name','previous_name','reason')) then raise exception 'INVALID_WORKSPACE_CORRECTION';end if;
 if kind='ORGANIZATION' then select name into old_name from organizations where id=target_id for update;
 else select business_name into old_name from provider_profiles where id=target_id for update;end if;
 if not found then raise exception 'NOT_FOUND';end if;
 if old_name is distinct from command->>'previous_name' then raise exception 'WORKSPACE_CHANGED';end if;
 if kind='ORGANIZATION' then update organizations set name=name_value where id=target_id;
 else update provider_profiles set business_name=name_value where id=target_id;end if;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ADMIN_WORKSPACE_CORRECTED',lower(kind),target_id,jsonb_build_object('before',old_name,'after',name_value,'reason',reason));
 return jsonb_build_object('updated',true);
end $$;
create function public.admin_tracking_location(actor_user_id uuid,target_shipment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('operational_status',s.operational_status,'origin',s.origin,'origin_lat',s.origin_lat,'origin_lng',s.origin_lng,
  'destination',s.destination,'destination_lat',s.destination_lat,'destination_lng',s.destination_lng,'current_location',location.record) into result
 from provider_shipments s join lateral (
  select jsonb_build_object('location_area',e.location_area,'location_lat',e.location_lat,'location_lng',e.location_lng,
   'location_precision_km',e.location_precision_km,'updated_at',e.created_at) as record
  from provider_shipment_events e where e.shipment_id=s.id and e.location_source='DEVICE_OBSCURED'
   and (s.location_reset_at is null or e.created_at>=s.location_reset_at)
  order by e.created_at desc,e.id desc limit 1
 )location on true
 where s.id=target_shipment_id and s.tracking_mode='LOCATION_AND_STATUS' and s.operational_status in ('TO_PICKUP','IN_TRANSIT');
 return result;
end $$;
revoke all on function public.correct_admin_workspace(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.admin_tracking_location(uuid,uuid) from public,anon,authenticated;
grant execute on function public.correct_admin_workspace(uuid,uuid,jsonb) to service_role;
grant execute on function public.admin_tracking_location(uuid,uuid) to service_role;
