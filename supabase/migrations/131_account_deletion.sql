-- FEAT-PLY-001 / FEAT-IAM-001. Requests are accepted even while work is unresolved.
-- Erasure is a separate explicit, audited administrator command. No browser grants.
create table public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 subject_user_id uuid not null unique references public.profiles(id),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','HELD','ERASING','COMPLETED')),
 requested_at timestamptz not null default clock_timestamp(),
 review_due_at timestamptz not null default clock_timestamp()+interval '30 days',
 retention_reason text, review_after timestamptz,
 reviewed_by uuid references public.profiles(id), completed_at timestamptz,
 check((status='HELD')=(retention_reason is not null and review_after is not null)),
 check((status='COMPLETED')=(completed_at is not null))
);
create table public.account_erasure_files (
 request_id uuid not null references public.account_deletion_requests(id),
 storage_path text not null check(storage_path ~ '^supabase://(verification|provider-profile|capacity-photo|shipment-proof|support-attachment|payment-proof)/[^.][^?]*$'),
 removed_at timestamptz,
 primary key(request_id,storage_path)
);
alter table public.account_deletion_requests enable row level security;
alter table public.account_erasure_files enable row level security;
revoke all on public.account_deletion_requests,public.account_erasure_files from public,anon,authenticated;
grant select,insert,update,delete on public.account_deletion_requests,public.account_erasure_files to service_role;

create function public.account_deletion_status(actor_user_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('id',r.id,'status',r.status,'requestedAt',r.requested_at,
 'reviewDueAt',r.review_due_at,'retentionReason',r.retention_reason,'reviewAfter',r.review_after,'completedAt',r.completed_at)
 from account_deletion_requests r where r.subject_user_id=actor_user_id),'null'::jsonb)
$$;
create function public.request_account_deletion(actor_user_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from profiles where id=actor_user_id and role in ('TRANSPORTER','DRIVER') for update;
 if not found then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from auth.users where id=actor_user_id and deleted_at is null
 and email_confirmed_at is not null and last_sign_in_at>=clock_timestamp()-interval '10 minutes') then raise exception 'ACCOUNT_REAUTH_REQUIRED';end if;
 insert into account_deletion_requests(subject_user_id) values(actor_user_id) on conflict(subject_user_id) do nothing;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_DELETION_REQUESTED','profile',actor_user_id,'{}');
 return account_deletion_status(actor_user_id);
end $$;

create function public.prepare_account_erasure(actor_user_id uuid,target_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r account_deletion_requests%rowtype; subject profiles%rowtype; orgs uuid[]; providers uuid[]; trucks uuid[]; devices uuid[]; reason text;
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 select * into r from account_deletion_requests where id=target_request_id;
 if not found then raise exception 'NOT_FOUND';end if;
 -- Same org/profile lock order as fleet lifecycle; never use a stale pre-lock scope.
 perform 1 from organizations where id in(select organization_id from organization_members where user_id=r.subject_user_id and membership_role='OWNER') order by id for update;
 select * into subject from profiles where id=r.subject_user_id for update;
 if subject.role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN';end if;
 select * into r from account_deletion_requests where id=target_request_id for update;
 if r.status='COMPLETED' then return jsonb_build_object('status','COMPLETED');end if;
 if r.status='ERASING' then return jsonb_build_object('status','ERASING','subjectId',subject.id,'authErased',exists(select 1 from auth.users where id=subject.id and deleted_at is not null));end if;
 select coalesce(array_agg(organization_id),'{}') into orgs from organization_members where user_id=subject.id and membership_role='OWNER';
 select coalesce(array_agg(id),'{}') into providers from provider_profiles where user_id=subject.id;
 if exists(select 1 from provider_shipments s where s.operational_status not in ('COMPLETED','CANCELLED')
 and(s.assigned_driver_user_id=subject.id or s.provider_organization_id=any(orgs) or s.provider_profile_id=any(providers)
 or exists(select 1 from provider_tracking_recipients p where p.shipment_id=s.id and lower(p.recipient_email)=lower(subject.email) and p.revoked_at is null))) then
 reason:='An unfinished shipment must be completed or resolved before its tracking records can be removed.';
 elsif exists(select 1 from organization_members m join profiles p on p.id=m.user_id where m.organization_id=any(orgs) and m.user_id<>subject.id and p.active) then
 reason:='Transfer or close your company workspace first so other drivers and owners do not lose their records.';
 end if;
 if reason is not null then
 update account_deletion_requests set status='HELD',retention_reason=reason,review_after=clock_timestamp()+interval '7 days',reviewed_by=actor_user_id where id=r.id;
 return jsonb_build_object('status','HELD');end if;
 select coalesce(array_agg(id),'{}') into trucks from vehicles where organization_id=any(orgs) or provider_profile_id=any(providers);
 delete from account_erasure_files where request_id=r.id;
 insert into account_erasure_files(request_id,storage_path)
 select r.id,path from (
 select file_path path from driver_portrait_uploads where user_id=subject.id
 union select storage_path from verification_requests where (subject_type='PROVIDER_PROFILE' and subject_id=any(providers))
 or(subject_type='ORGANIZATION' and subject_id=any(orgs)) or(subject_type='VEHICLE' and subject_id=any(trucks))
 or(subject_type='DRIVER' and(subject_id=subject.id or subject_id in(select id from drivers where user_id=subject.id)))
 union select profile_image_path from company_pages where organization_id=any(orgs) or provider_profile_id=any(providers)
 union select photo_storage_path from capacities where updated_by=subject.id or vehicle_id=any(trucks)
 union select proof_storage_path from provider_shipment_events where created_by=subject.id
 union select storage_path from proof_files where uploaded_by=subject.id
 union select p.file_path from payment_proofs p join subscriptions s on s.id=p.subscription_id
 where s.organization_id=any(orgs) or s.provider_profile_id=any(providers)
 union select file_path from support_attachments where conversation_id in(select id from support_conversations where customer_user_id=subject.id)
 ) files where path is not null on conflict do nothing;
 if exists(select 1 from account_erasure_files f where f.request_id=r.id and (
 exists(select 1 from driver_portrait_uploads x where x.file_path=f.storage_path and x.user_id<>subject.id)
 or exists(select 1 from company_pages x where x.profile_image_path=f.storage_path and not(coalesce(x.organization_id=any(orgs),false) or coalesce(x.provider_profile_id=any(providers),false)))
 or exists(select 1 from verification_requests x where x.storage_path=f.storage_path and not(
 (x.subject_type='PROVIDER_PROFILE' and x.subject_id=any(providers)) or(x.subject_type='ORGANIZATION' and x.subject_id=any(orgs))
 or(x.subject_type='VEHICLE' and x.subject_id=any(trucks)) or(x.subject_type='DRIVER' and(x.subject_id=subject.id or x.subject_id in(select id from drivers where user_id=subject.id)))))
 or exists(select 1 from capacities x where x.photo_storage_path=f.storage_path and x.updated_by<>subject.id and x.vehicle_id<>all(trucks))
 or exists(select 1 from provider_shipment_events x where x.proof_storage_path=f.storage_path and x.created_by is distinct from subject.id)
 or exists(select 1 from proof_files x where x.storage_path=f.storage_path and x.uploaded_by<>subject.id)
 or exists(select 1 from support_attachments x join support_conversations c on c.id=x.conversation_id where x.file_path=f.storage_path and c.customer_user_id<>subject.id)
 )) then
 update account_deletion_requests set status='HELD',retention_reason='Some files are also used by another account. Our team must review those shared records before deleting them.',review_after=clock_timestamp()+interval '7 days',reviewed_by=actor_user_id where id=r.id;
 return jsonb_build_object('status','HELD');end if;
 -- Fail closed on unrecognized storage references rather than mark false completion.
 update account_deletion_requests set status='ERASING',retention_reason=null,review_after=null,reviewed_by=actor_user_id where id=r.id;
 update profiles set active=false,account_deactivated_at=coalesce(account_deactivated_at,clock_timestamp()) where id=subject.id;
 update provider_profiles set public_visibility='PRIVATE' where id=any(providers);
 update organizations set public_visibility='PRIVATE' where id=any(orgs);
 update company_pages set published=false where organization_id=any(orgs) or provider_profile_id=any(providers);
 update vehicles set active=false where id=any(trucks);
 update drivers set active=false where user_id=subject.id;
 update driver_vehicle_assignments set active=false where driver_user_id=subject.id or vehicle_id=any(trucks);
 update tracking_device_leases set revoked_at=clock_timestamp() where driver_user_id=subject.id and revoked_at is null;
 select coalesce(array_agg(b.installation_id),'{}') into devices from native_push_bindings b where b.actor_user_id=subject.id;
 delete from native_push_bindings b where b.actor_user_id=subject.id;
 delete from native_push_installations i where i.id=any(devices) and not exists(select 1 from native_push_bindings b where b.installation_id=i.id);
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_ERASURE_STARTED','account_deletion_request',r.id,'{}');
 return jsonb_build_object('status','ERASING','subjectId',subject.id);
end $$;

create function public.finish_account_erasure(actor_user_id uuid,target_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r account_deletion_requests%rowtype; subject profiles%rowtype; orgs uuid[]; providers uuid[]; trucks uuid[];
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 select * into r from account_deletion_requests where id=target_request_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.status='COMPLETED' then return account_deletion_status(r.subject_user_id);end if;
 if r.status<>'ERASING' or exists(select 1 from account_erasure_files where request_id=r.id and removed_at is null)
 or exists(select 1 from auth.users where id=r.subject_user_id and deleted_at is null) then raise exception 'ERASURE_CLEANUP_INCOMPLETE';end if;
 select * into subject from profiles where id=r.subject_user_id for update;
 select coalesce(array_agg(organization_id),'{}') into orgs from organization_members where user_id=subject.id and membership_role='OWNER';
 select coalesce(array_agg(id),'{}') into providers from provider_profiles where user_id=subject.id;
 select coalesce(array_agg(id),'{}') into trucks from vehicles where organization_id=any(orgs) or provider_profile_id=any(providers);
 -- Remove user-authored payloads; preserve pseudonymous business event IDs/statuses.
 delete from support_attachments where conversation_id in(select id from support_conversations where customer_user_id=subject.id);
 delete from support_chat_read_cursors where reader_user_id=subject.id;
 delete from support_conversations where customer_user_id=subject.id;
 delete from driver_portrait_uploads where user_id=subject.id;
 delete from verification_requests where (subject_type='PROVIDER_PROFILE' and subject_id=any(providers))
 or(subject_type='ORGANIZATION' and subject_id=any(orgs)) or(subject_type='VEHICLE' and subject_id=any(trucks))
 or(subject_type='DRIVER' and(subject_id=subject.id or subject_id in(select id from drivers where user_id=subject.id)));
 update company_pages set headline=null,about=null,services=null,corridors=null,operating_regions=null,
 contact_phone=null,contact_email=null,contact_whatsapp=null,contact_website=null,youtube_video_id=null,
 profile_image_path=null,profile_image_mime=null,profile_image_preset=null,published=false
 where organization_id=any(orgs) or provider_profile_id=any(providers);
 update provider_profiles set business_name='Deleted transporter',handle='deleted-'||id,phone=null,city=null,city_place_ref=null,city_lat=null,city_lng=null,about=null,corridors=null,
 verified_identity=false,verified_license=false,vehicle_documents_verified=false where id=any(providers);
 update organizations set name='Deleted transporter',handle='deleted-'||id,description=null,phone=null,email=null,city=null,city_place_ref=null,city_lat=null,city_lng=null,verified=false where id=any(orgs);
 update vehicles set plate=null,label='Archived truck' where id=any(trucks);
 update drivers set name='Deleted driver',phone=null where user_id=subject.id;
 delete from service_areas where organization_id=any(orgs) or provider_profile_id=any(providers);
 delete from profile_routes where organization_id=any(orgs) or provider_profile_id=any(providers);
 delete from capacity_access_grants where created_by=subject.id or vehicle_id=any(trucks);
 delete from vehicle_capacity_sharing where vehicle_id=any(trucks);
 delete from capacities where updated_by=subject.id or vehicle_id=any(trucks);
 delete from vehicle_driver_locations where driver_user_id=subject.id;
 update provider_shipment_events set note=null,proof_storage_path=null,proof_original_name=null,proof_mime_type=null,
 location_area=null,location_lat=null,location_lng=null,location_precision_km=null,location_source=null where created_by=subject.id;
 delete from proof_files where uploaded_by=subject.id;
 update provider_shipments set shipper_email=case when lower(shipper_email)=lower(subject.email) then 'deleted@account.invalid' else shipper_email end,
 receiver_email=case when lower(receiver_email)=lower(subject.email) then 'deleted@account.invalid' else receiver_email end
 where lower(shipper_email)=lower(subject.email) or lower(receiver_email)=lower(subject.email);
 delete from applications where user_id=subject.id;
 delete from provider_signup_intents where auth_user_id=subject.id;
 delete from fleet_driver_invitations where accepted_by=subject.id or organization_id=any(orgs) or lower(email)=lower(subject.email);
 delete from email_deliveries where lower(recipient_email)=lower(subject.email);
 delete from access_email_deliveries where lower(recipient_email)=lower(subject.email);
 delete from shared_capacity_email_otps where lower(recipient_email)=lower(subject.email);
 delete from provider_tracking_recipients where lower(recipient_email)=lower(subject.email);
 update provider_tracking_appeals set reason='Deleted account',resolution_note=null where driver_user_id=subject.id;
 update provider_tracking_recoveries x set reason='Deleted account',before_state='{}',after_state='{}' where x.actor_user_id=subject.id;
 update shipment_events set note=null,location_area=null,location_lat=null,location_lng=null,location_precision_km=null,location_source=null where created_by=subject.id;
 delete from partner_relationships where provider_profile_id=any(providers) or provider_organization_id=any(orgs);
 update payment_proofs p set reference='Deleted account',file_path=null,original_name=null,mime_type=null
 from subscriptions s where s.id=p.subscription_id and(s.organization_id=any(orgs) or s.provider_profile_id=any(providers));
 update audit_logs a set details='{}' where a.actor_user_id=subject.id;
 update profiles set full_name='Deleted account',email='deleted-'||id||'@account.invalid',phone=null,driver_portrait_preset=null where id=subject.id;
 update account_deletion_requests set status='COMPLETED',completed_at=clock_timestamp() where id=r.id;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_ERASURE_COMPLETED','account_deletion_request',r.id,'{}');
 return account_deletion_status(subject.id);
end $$;
revoke all on function public.account_deletion_status(uuid),public.request_account_deletion(uuid),public.prepare_account_erasure(uuid,uuid),public.finish_account_erasure(uuid,uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_status(uuid),public.request_account_deletion(uuid),public.prepare_account_erasure(uuid,uuid),public.finish_account_erasure(uuid,uuid) to service_role;
