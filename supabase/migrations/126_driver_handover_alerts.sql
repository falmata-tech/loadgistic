-- FEAT-NOT-001: project committed handovers; do not create approval or change Tracking.
create table public.driver_handover_alert_reads (
 shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
 driver_user_id uuid not null references public.profiles(id) on delete cascade,
 approved_at timestamptz not null,
 seen_at timestamptz not null default clock_timestamp(),
 primary key(shipment_id,driver_user_id)
);
alter table public.driver_handover_alert_reads enable row level security;
revoke all on public.driver_handover_alert_reads from public,anon,authenticated;
grant select,insert,update,delete on public.driver_handover_alert_reads to service_role;
create index provider_shipments_driver_handover_alert on public.provider_shipments(assigned_driver_user_id,handover_approved_at desc)
 where handover_approved_at is not null;

create function public.driver_handover_alert_snapshot(actor_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=actor_user_id and active) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.profiles where id=actor_user_id and role='DRIVER') then
  return jsonb_build_object('unreadCount',0,'items','[]'::jsonb);end if;
 with scoped as (
  select s.id,s.handover_approved_at,s.handover_approval_kind,
   r.approved_at is distinct from s.handover_approved_at as unread
  from public.provider_shipments s left join public.driver_handover_alert_reads r
   on r.shipment_id=s.id and r.driver_user_id=actor_user_id
  where s.assigned_driver_user_id=actor_user_id and s.operational_status='COMPLETED'
   and s.handover_approved_at is not null and s.handover_approval_kind in ('OWNER','STAFF')
   and public.provider_tracking_actor_owns_shipment(actor_user_id,s.id)
 ), limited as (select * from scoped order by unread desc,handover_approved_at desc,id limit 40)
 select jsonb_build_object('unreadCount',(select count(*) from scoped where unread),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'approvedAt',handover_approved_at,
   'approvalKind',handover_approval_kind,'unread',unread) order by unread desc,handover_approved_at desc,id) from limited),'[]'::jsonb)) into result;
 return result;
end;
$$;
create function public.acknowledge_driver_handover_alert(actor_user_id uuid,target_shipment_id uuid,expected_approved_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare shipment public.provider_shipments%rowtype;
begin
 select * into shipment from public.provider_shipments where id=target_shipment_id for update;
 if not found or shipment.assigned_driver_user_id is distinct from actor_user_id
  or not exists(select 1 from public.profiles where id=actor_user_id and active and role='DRIVER')
  or not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id)
 then raise exception 'FORBIDDEN';end if;
 if shipment.operational_status<>'COMPLETED' or shipment.handover_approved_at is null
  or expected_approved_at is distinct from shipment.handover_approved_at
 then raise exception 'HANDOVER_ALERT_CHANGED';end if;
 insert into public.driver_handover_alert_reads(shipment_id,driver_user_id,approved_at)
 values(shipment.id,actor_user_id,shipment.handover_approved_at)
 on conflict(shipment_id,driver_user_id) do update set approved_at=excluded.approved_at,seen_at=clock_timestamp()
 where driver_handover_alert_reads.approved_at is distinct from excluded.approved_at;
 return public.driver_handover_alert_snapshot(actor_user_id);
end;
$$;
revoke all on function public.driver_handover_alert_snapshot(uuid),public.acknowledge_driver_handover_alert(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.driver_handover_alert_snapshot(uuid),public.acknowledge_driver_handover_alert(uuid,uuid,timestamptz) to service_role;
alter table public.platform_controls add column driver_handover_alerts boolean not null default true check(driver_handover_alerts);
notify pgrst,'reload schema';
