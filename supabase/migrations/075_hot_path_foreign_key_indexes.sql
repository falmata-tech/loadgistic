-- BASE-DEP-001
-- Additive covering indexes for observed hosted foreign-key findings on common
-- Fleet, Tracking, Featured, Support, Verification, Sponsor, and audit paths.

create index if not exists applications_user_idx
  on public.applications(user_id);

create index if not exists audit_logs_actor_idx
  on public.audit_logs(actor_user_id);
create index if not exists audit_logs_organization_idx
  on public.audit_logs(organization_id);

create index if not exists vehicles_organization_idx
  on public.vehicles(organization_id);
create index if not exists vehicles_provider_profile_idx
  on public.vehicles(provider_profile_id);
create index if not exists drivers_organization_idx
  on public.drivers(organization_id);
create index if not exists driver_vehicle_assignments_vehicle_idx
  on public.driver_vehicle_assignments(vehicle_id);

create index if not exists provider_shipment_events_created_by_idx
  on public.provider_shipment_events(created_by);
create index if not exists email_deliveries_shipment_idx
  on public.email_deliveries(shipment_id);

create index if not exists featured_provider_slots_vehicle_idx
  on public.featured_provider_slots(vehicle_id);
create index if not exists featured_provider_slots_driver_idx
  on public.featured_provider_slots(driver_user_id);
create index if not exists featured_provider_slots_organization_idx
  on public.featured_provider_slots(provider_organization_id);
create index if not exists featured_provider_slots_profile_idx
  on public.featured_provider_slots(provider_profile_id);

create index if not exists guest_support_attachments_conversation_idx
  on public.guest_support_attachments(conversation_id);
create index if not exists guest_support_attachments_message_idx
  on public.guest_support_attachments(message_id);

create index if not exists verification_requests_vehicle_idx
  on public.verification_requests(related_vehicle_id);
create index if not exists verification_requests_submitted_by_idx
  on public.verification_requests(submitted_by);
create index if not exists verification_requests_reviewed_by_idx
  on public.verification_requests(reviewed_by);

create index if not exists sponsor_placements_sponsor_idx
  on public.sponsor_placements(sponsor_id);
