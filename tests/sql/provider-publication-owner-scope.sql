-- FEAT-VER/FLT/PLY-001: a free Live slot never creates owner authority.
-- Synthetic identities, real commands and rollback-only execution.
begin;
create function pg_temp.publication_scope_denied(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'PUBLICATION_SCOPE_DENIAL_MISSING';
end $$;
do $scope$
declare owner_id uuid:=gen_random_uuid();business_owner uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();org uuid:=gen_random_uuid();
 truck uuid;origin_ref text;destination_ref text;capacity_command jsonb;capacity_id uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,owner_id||'@example.test',now(),'{}','{}'),(business_owner,business_owner||'@example.test',now(),'{}','{}');
 update profiles set active=true,role='DRIVER',drives_truck=true where id=owner_id;
 update profiles set active=true,role='TRANSPORTER' where id=business_owner;
 insert into provider_profiles(id,user_id,business_name,handle,public_visibility) values(provider,owner_id,'Synthetic private scope','scope-'||owner_id,'PRIVATE');
 insert into organizations(id,name,handle,type,public_visibility) values(org,'Synthetic private business','scope-'||business_owner,'TRANSPORT_COMPANY','PRIVATE');
 insert into organization_members(user_id,organization_id,membership_role) values(business_owner,org,'OWNER');
 perform accept_content_policy(owner_id,'2026-10-09');perform accept_content_policy(business_owner,'2026-10-09');
 if not provider_scope_can_publish(null,provider) or not provider_scope_can_publish(org,null)
 then raise exception 'PRIVATE_VALID_OWNER_LOST_FREE_SLOT';end if;
 if provider_scope_can_publish(null,null) or provider_scope_can_publish(org,provider)
 then raise exception 'PUBLICATION_SCOPE_XOR_IGNORED';end if;
 if provider_scope_can_publish(gen_random_uuid(),null) or provider_scope_can_publish(null,gen_random_uuid())
 then raise exception 'UNKNOWN_SCOPE_GOT_FREE_SLOT';end if;
 update profiles set active=false where id in(owner_id,business_owner);
 if provider_scope_can_publish(null,provider) or provider_scope_can_publish(org,null)
 then raise exception 'INACTIVE_OWNER_GOT_FREE_SLOT';end if;
 update profiles set active=true where id in(owner_id,business_owner);
 update auth.users set deleted_at=now() where id in(owner_id,business_owner);
 if provider_scope_can_publish(null,provider) or provider_scope_can_publish(org,null)
 then raise exception 'DELETED_OWNER_GOT_FREE_SLOT';end if;
 update auth.users set deleted_at=null where id in(owner_id,business_owner);
 update profiles set role='TRANSPORTER' where id=owner_id;
 update profiles set role='DRIVER' where id=business_owner;
 if provider_scope_can_publish(null,provider) or provider_scope_can_publish(org,null)
 then raise exception 'WRONG_OWNER_ROLE_GOT_FREE_SLOT';end if;
 update profiles set role='DRIVER' where id=owner_id;
 update profiles set role='TRANSPORTER' where id=business_owner;
 update organizations set type='ENTERPRISE_SHIPPER' where id=org;
 if provider_scope_can_publish(org,null) then raise exception 'NON_PROVIDER_ORGANIZATION_GOT_FREE_SLOT';end if;
 update organizations set type='TRANSPORT_COMPANY' where id=org;
 delete from organization_members where user_id=business_owner and organization_id=org;
 if provider_scope_can_publish(org,null) then raise exception 'OWNERLESS_ORGANIZATION_GOT_FREE_SLOT';end if;
 insert into organization_members(user_id,organization_id,membership_role) values(business_owner,org,'OWNER');
 truck:=(create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Publication scope","plate":"SCOPE-DRAFT","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',owner_id,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 select id into strict origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from place_catalog where normalized_name='adama' limit 1;
 capacity_command:=jsonb_build_object('vehicle_id',truck,'status','EMPTY','visibility','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20);
 perform pg_temp.publication_scope_denied(format('select publish_provider_capacity(%L,%L)',owner_id,capacity_command),'TRUCK_NOT_LIVE');
 if exists(select 1 from capacities where vehicle_id=truck and coalesce(market_status,status::text) in('EMPTY','PARTIAL'))
 then raise exception 'DRAFT_CAPACITY_SAVED';end if;
 perform set_provider_vehicle_publication(owner_id,truck,'LIVE');
 capacity_id:=publish_provider_capacity(owner_id,capacity_command);
 if not exists(select 1 from capacities where id=capacity_id and vehicle_id=truck and coalesce(market_status,status::text)='EMPTY')
 then raise exception 'FIRST_FREE_LIVE_CAPACITY_NOT_SAVED';end if;
end $scope$;
rollback;
