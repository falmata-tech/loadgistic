-- FEAT-UIX-001: local fixture changes are rolled back; no history is deleted.
begin;
do $test$
declare actor_id uuid; org uuid; shipment_id uuid; vehicle_id uuid; before_count bigint; result jsonb;
begin
  select id into strict actor_id from profiles where email='transporter@loadgistic.local';
  select organization_id into strict org from organization_members where user_id=actor_id and membership_role='OWNER';
  select id into strict shipment_id from provider_shipments where provider_organization_id=org order by created_at limit 1;
  update provider_shipments set operational_status='CREATED' where id=shipment_id;
  before_count:=(workspace_dashboard(actor_id)->'counts'->>'Active Tracking')::bigint;
  update provider_shipments set operational_status='CANCELLED' where id=shipment_id;
  result:=workspace_dashboard(actor_id);
  if (result->'counts'->>'Active Tracking')::bigint<>before_count-1 then raise exception 'CANCELLED_COUNTED_AS_ACTIVE';end if;
  if (result->'counts'->>'Completed Tracking')::bigint<>(select count(*) from provider_shipments where provider_organization_id=org and operational_status='COMPLETED') then raise exception 'CANCELLATION_COUNTED_AS_COMPLETION';end if;
  update provider_shipments set operational_status='COMPLETED' where id=shipment_id;
  if (workspace_dashboard(actor_id)->'counts'->>'Active Tracking')::bigint<>before_count-1 then raise exception 'COMPLETED_COUNTED_AS_ACTIVE';end if;
  update provider_shipments set created_at=now()-interval '1 year',updated_at=now()+interval '1 day' where id=shipment_id;
  result:=workspace_dashboard(actor_id);
  if result->'recent'->0->>'id' is distinct from shipment_id::text then raise exception 'RECENT_IGNORES_ACTIVITY';end if;
  if jsonb_array_length(result->'recent')>6 then raise exception 'UNBOUNDED_RECENT';end if;
  if exists(select 1 from jsonb_array_elements(result->'recent') item join provider_shipments s on s.id=(item->>'id')::uuid where s.provider_organization_id is distinct from org) then raise exception 'CROSS_WORKSPACE_RECENT';end if;
  select v.id into strict vehicle_id from vehicles v join lateral(select coalesce(c.market_status,c.status::text) as status from capacities c where c.vehicle_id=v.id order by c.updated_at desc,c.id desc limit 1) latest on true where v.organization_id=org and v.active and latest.status in ('EMPTY','PARTIAL') limit 1;
  before_count:=(workspace_dashboard(actor_id)->'counts'->>'On-duty Trucks')::bigint;
  update vehicles set active=false where id=vehicle_id;
  if (workspace_dashboard(actor_id)->'counts'->>'On-duty Trucks')::bigint<>before_count-1 then raise exception 'INACTIVE_TRUCK_COUNTED_ON_DUTY';end if;
  update profiles set active=false where id=actor_id;
  begin perform workspace_dashboard(actor_id);raise exception 'INACTIVE_ACTOR_ALLOWED';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  if has_function_privilege('anon','workspace_dashboard(uuid)','EXECUTE') or has_function_privilege('authenticated','workspace_dashboard(uuid)','EXECUTE') then raise exception 'BROWSER_PROJECTION_EXPOSED';end if;
  raise notice 'PASS: cancelled/completed counts, actual activity ordering, bounded tenant scope, active truck counts and denied inactive/browser access';
end $test$;
rollback;
