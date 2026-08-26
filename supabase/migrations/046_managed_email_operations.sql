-- BASE-DEP-001 / FEAT-TRK-001
-- Complete the customer-safe completion-email projection used by the bounded
-- Netlify worker. The worker still claims rows through SKIP LOCKED and never
-- receives proof paths, actor identities, customer contacts beyond the leased
-- recipient, or location coordinates.

create or replace function public.pending_provider_tracking_email_deliveries(requested_limit integer default 20)
returns table(payload jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  return query
    with candidates as (
      select delivery.id
      from public.email_deliveries delivery
      where delivery.status in ('PENDING','FAILED')
        and (delivery.next_attempt_at is null or delivery.next_attempt_at<=now())
        and delivery.attempts<6
      order by delivery.created_at,delivery.id
      for update skip locked
      limit greatest(1,least(coalesce(requested_limit,20),100))
    ), claimed as (
      update public.email_deliveries delivery
      set next_attempt_at=now()+interval '10 minutes',updated_at=now()
      from candidates where delivery.id=candidates.id
      returning delivery.*
    )
    select to_jsonb(claimed)||jsonb_build_object(
      'code',shipment.code,'origin',shipment.origin,'destination',shipment.destination,
      'cargo_summary',shipment.cargo_summary,'operational_status',shipment.operational_status,
      'completed_at',shipment.completed_at,
      'provider_name',coalesce(organization.name,provider.business_name),
      'events',coalesce(events.records,'[]'::jsonb)
    )
    from claimed
    join public.provider_shipments shipment on shipment.id=claimed.shipment_id
    left join public.organizations organization on organization.id=shipment.provider_organization_id
    left join public.provider_profiles provider on provider.id=shipment.provider_profile_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'status',event.status,'note',event.note,'created_at',event.created_at
      ) order by event.created_at,event.id) as records
      from public.provider_shipment_events event
      where event.shipment_id=shipment.id and event.event_type='STATUS'
    ) events on claimed.delivery_kind='COMPLETION'
    order by claimed.created_at,claimed.id;
end;
$$;

revoke all on function public.pending_provider_tracking_email_deliveries(integer) from public,anon,authenticated;
grant execute on function public.pending_provider_tracking_email_deliveries(integer) to service_role;

comment on function public.pending_provider_tracking_email_deliveries(integer) is
  'Leases a bounded email batch and projects only the customer-safe shipment summary and ordered Status timeline needed by the managed delivery worker.';
