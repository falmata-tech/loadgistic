-- FEAT-SIM-001 / NR-83. Owner-operated contact correction.
-- Supply example_phone and apply=false to review a count and fingerprint.
-- An apply requires that exact fingerprint as expected_digest and apply=true.
\set ON_ERROR_STOP on
begin;
set local search_path=pg_catalog,public,pg_temp;
set local lock_timeout='5s';
set local statement_timeout='30s';
select set_config('loadgistic.example_phone', :'example_phone', true) as example_target \gset
do $validate$
begin
 if current_setting('loadgistic.example_phone') !~ '^\+[1-9][0-9]{7,14}$' then
  raise exception 'EXAMPLE_PHONE_INVALID';
 end if;
end $validate$;
\if :apply
select pg_advisory_xact_lock(8030246);
-- Prevent ownership edits and lock the example rows for the short apply.
lock table public.organization_members in share mode nowait;
\endif

create temp table example_users on commit drop as
select identity.id,identity.raw_app_meta_data->>'fixture_source' as fixture_source
from auth.users identity
where identity.deleted_at is null and identity.raw_app_meta_data->>'fixture_source'
 in ('loadgistic','loadgistic-production-pilot-v1');
create temp table example_organizations on commit drop as
select membership.organization_id as id
from public.organization_members membership
left join example_users fixture on fixture.id=membership.user_id
left join public.profiles profile on profile.id=membership.user_id
where membership.membership_role='OWNER'
group by membership.organization_id
having bool_and(fixture.id is not null and profile.active is true);
create temp table example_providers on commit drop as
select provider.id from public.provider_profiles provider join example_users fixture on fixture.id=provider.user_id;

\if :apply
select count(*) as locked_identity_count from
 (select identity.id from auth.users identity join example_users fixture on fixture.id=identity.id
  for update of identity nowait) locked \gset
select count(*) as locked_profile_count from
 (select profile.id from public.profiles profile join example_users fixture using(id)
  for update of profile nowait) locked \gset
select count(*) as locked_provider_count from
 (select provider.id from public.provider_profiles provider join example_providers scope using(id)
  for update of provider nowait) locked \gset
select count(*) as locked_organization_count from
 (select organization.id from public.organizations organization join example_organizations scope using(id)
  for update of organization nowait) locked \gset
\endif

create temp table example_pages on commit drop as
select page.id
from public.company_pages page
where page.provider_profile_id in(select id from example_providers)
 or page.organization_id in(select id from example_organizations);
create temp table example_drivers on commit drop as
select driver.id
from public.drivers driver join example_users fixture on fixture.id=driver.user_id
where driver.organization_id in(select id from example_organizations)
 or driver.provider_profile_id in(select id from example_providers);
\if :apply
select count(*) as locked_page_count from
 (select page.id from public.company_pages page join example_pages fixture using(id)
  for update of page nowait) locked \gset
select count(*) as locked_driver_count from
 (select driver.id from public.drivers driver join example_drivers fixture using(id)
  for update of driver nowait) locked \gset
\endif

create temp table example_contact_plan on commit drop as
select 'profile' as kind, profile.id,
 jsonb_build_array(fixture.fixture_source,profile.phone,profile.public_callback_phone,profile.public_callback_phone_configured) as before
 from public.profiles profile join example_users fixture using(id)
union all select 'organization',organization.id,jsonb_build_array(organization.phone)
 from public.organizations organization join example_organizations fixture using(id)
union all select 'provider',provider.id,jsonb_build_array(provider.user_id,provider.phone)
 from public.provider_profiles provider join example_providers fixture using(id)
union all select 'page',page.id,jsonb_build_array(page.provider_profile_id,page.organization_id,page.contact_phone,page.contact_whatsapp,page.contact_website,
    page.show_contact_phone,page.show_contact_whatsapp,page.show_contact_website)
 from public.company_pages page join example_pages fixture using(id)
union all select 'driver',driver.id,jsonb_build_array(driver.user_id,driver.organization_id,driver.provider_profile_id,driver.phone)
 from public.drivers driver join example_drivers fixture using(id);

create temp table example_contact_review on commit drop as
select encode(sha256(convert_to(jsonb_build_array(current_setting('loadgistic.example_phone'),
    'https://example.com',coalesce(jsonb_agg(to_jsonb(plan) order by kind,id),'[]'::jsonb))::text,'UTF8')),'hex') as digest,
 count(*) as rows from example_contact_plan plan;
select digest,rows from example_contact_review;
select kind,count(*) from example_contact_plan group by kind order by kind;

\if :apply
select set_config('loadgistic.example_expected', :'expected_digest', true) as expected_target \gset
do $apply$
declare phone_value constant text:=current_setting('loadgistic.example_phone');
begin
 if not exists(select 1 from example_contact_review
   where rows>0 and digest=current_setting('loadgistic.example_expected')) then
  raise exception 'EXAMPLE_CONTACT_SCOPE_CHANGED';
 end if;
 -- Recheck provenance after taking the row locks.
 if exists(select 1 from example_users fixture join auth.users identity using(id)
   where identity.deleted_at is not null or identity.raw_app_meta_data->>'fixture_source' is distinct from fixture.fixture_source) then
  raise exception 'EXAMPLE_CONTACT_IDENTITY_CHANGED';
 end if;
 if exists(select 1 from example_organizations scope
   join public.organization_members member on member.organization_id=scope.id and member.membership_role='OWNER'
   left join example_users fixture on fixture.id=member.user_id
   left join public.profiles profile on profile.id=member.user_id
   where fixture.id is null or profile.active is distinct from true) then
  raise exception 'EXAMPLE_CONTACT_OWNER_CHANGED';
 end if;
 update public.profiles profile set phone=phone_value,
  public_callback_phone=case when nullif(btrim(profile.public_callback_phone),'') is not null then phone_value else profile.public_callback_phone end
  where id in(select id from example_contact_plan where kind='profile')
   and (phone is distinct from phone_value or nullif(btrim(public_callback_phone),'') is not null and public_callback_phone<>phone_value);
 update public.organizations set phone=phone_value
  where id in(select id from example_contact_plan where kind='organization') and phone is distinct from phone_value;
 update public.provider_profiles set phone=phone_value
  where id in(select id from example_contact_plan where kind='provider') and phone is distinct from phone_value;
 update public.company_pages set contact_phone=phone_value,
  contact_whatsapp=case when nullif(btrim(contact_whatsapp),'') is not null then phone_value else contact_whatsapp end,
  contact_website=case when nullif(btrim(contact_website),'') is not null then 'https://example.com' else contact_website end
  where id in(select id from example_contact_plan where kind='page')
   and (contact_phone is distinct from phone_value
    or nullif(btrim(contact_whatsapp),'') is not null and contact_whatsapp<>phone_value
    or nullif(btrim(contact_website),'') is not null and contact_website<>'https://example.com');
 update public.drivers set phone=phone_value
  where id in(select id from example_contact_plan where kind='driver') and phone is distinct from phone_value;
end $apply$;
commit;
\else
rollback;
\endif
