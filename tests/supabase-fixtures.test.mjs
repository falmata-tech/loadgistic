import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {
  applyManagedFixtureMarketPolicy,ensureIndependentVehicleAssignments,LONG_HAUL_VEHICLE_CONFIGURATIONS,normalizeDemoSharedEmails,
  selectSharedFixtureVehicleIds,SMALL_LOCAL_VEHICLE_CONFIGURATIONS
} from '../scripts/fixture-market-policy.mjs';
import {FEATURED_TRUCK_DAYS} from '../src/lib/featured-trucks.js';

const root=path.resolve(import.meta.dirname,'..');
const importer=path.join(root,'scripts','import-supabase-fixtures.mjs');

test('local managed signup verification uses only the isolated mail sink and numeric signup OTP',()=>{
  const configure=fs.readFileSync(path.join(root,'scripts','configure-local-supabase.mjs'),'utf8');
  const verifier=fs.readFileSync(path.join(root,'scripts','verify-supabase-provider-signup.mjs'),'utf8');
  const localConfig=fs.readFileSync(path.join(root,'supabase','config.toml'),'utf8');
  assert.match(configure,/INBUCKET_URL\|\|runtime\.MAILPIT_URL/);
  assert.match(configure,/SUPABASE_SEED_MAIL_URL:mailUrl/);
  assert.match(configure,/\['LOADGISTIC_LOCAL_MAILPIT_URL',mailUrl\]/);
  assert.match(configure,/--verify-signup/);
  assert.match(configure,/APP_URL','http:\/\/127\.0\.0\.1:3100'/);
  assert.match(localConfig,/site_url = "http:\/\/127\.0\.0\.1:3100"/);
  assert.match(verifier,/REMOTE_SIGNUP_MAIL_VERIFY_REFUSED/);
  assert.match(verifier,/verifyOtp\(\{email:otpEmail,token:code,type:'signup'\}\)/);
  assert.match(verifier,/verifyOtp\(\{email:otpEmail,token:code,type:'email'\}\)/);
});

test('fixture importer uses a credential-free managed source and creates the current Ethiopia Featured day',()=>{
  const source=fs.readFileSync(importer,'utf8');
  const verifier=fs.readFileSync(path.join(root,'scripts','verify-supabase-fixtures.mjs'),'utf8');
  const fixturePath=path.join(root,'resources','fixtures','managed-market.json');
  const fixtureText=fs.readFileSync(fixturePath,'utf8');
  const fixture=JSON.parse(fixtureText);
  assert.match(source,/managed-market\.json/);
  assert.match(source,/regionalExpoGroupForDate\(today\)/);
  assert.match(source,/ensureIndependentVehicleAssignments\(/);
  assert.match(source,/buildFeaturedFixtureTables\(\)/);
  assert.match(source,/provider_shipments: 1/);
  assert.match(source,/timeZone:'Africa\/Addis_Ababa'/);
  assert.match(source,/public_headline:'Daily Featured Trucks'/);
  assert.match(source,/vehicle_id:candidate\.vehicle\.id,driver_user_id:candidate\.assignment\.driver_user_id/);
  assert.doesNotMatch(source,/find their current trucks in the Truck Market/);
  assert.doesNotMatch(source,/node:sqlite|DATABASE_PATH|db\.js|repository\.js/);
  assert.match(source,/normalizeDemoSharedEmails\(process\.env\.LOADGISTIC_DEMO_SHARED_EMAILS\)/);
  assert.match(verifier,/SUPABASE_FIXTURE_VERIFY_EMAIL_GRANTS_INCOMPLETE/);
  assert.match(verifier,/SUPABASE_FIXTURE_VERIFY_LOADGISTIC_GRANTS_INCOMPLETE/);
  assert.equal(fixture.schema_version,1);
  assert.equal(fixture.tables.users.length,154);
  assert.equal(fixture.tables.capacities.length,143);
  assert.equal(fixture.tables.verification_requests.length,335);
  assert.doesNotMatch(fixtureText,/password_hash|password_digest|access_code|code_digest/);
  assert.doesNotMatch(fixtureText,/\/(?:Users|home)\//);
  for(const retired of ['shipments','shipment_events','shipment_interests','partner_relationships','business_reviews']){
    assert.equal(Object.hasOwn(fixture.tables,retired),false,retired);
  }
});

test('managed import assigns every independent truck to its owning Driver and supports every Featured theme',()=>{
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'resources','fixtures','managed-market.json'),'utf8'));
  const {vehicles,provider_profiles:profiles,driver_vehicle_assignments:existing}=fixture.tables;
  const assignedAt='2026-01-01T00:00:00.000Z';
  const assignments=ensureIndependentVehicleAssignments(vehicles,profiles,existing,{assignedAt});
  const activeByVehicle=new Map(assignments.filter(assignment=>Number(assignment.active)!==0)
    .map(assignment=>[assignment.vehicle_id,assignment]));
  const profileById=new Map(profiles.map(profile=>[profile.id,profile]));

  assert.equal(assignments.length,vehicles.length);
  assert.deepEqual(assignments.slice(0,existing.length),existing);
  for(const vehicle of vehicles.filter(candidate=>Number(candidate.active)!==0&&candidate.provider_profile_id)){
    const assignment=activeByVehicle.get(vehicle.id);
    assert.equal(assignment?.driver_user_id,profileById.get(vehicle.provider_profile_id)?.user_id,vehicle.id);
    assert.equal(assignment?.assigned_at,assignedAt,vehicle.id);
  }
  for(const theme of FEATURED_TRUCK_DAYS){
    assert.equal(vehicles.some(vehicle=>Number(vehicle.active)!==0
      &&theme.configurations.includes(vehicle.cargo_configuration)&&activeByVehicle.has(vehicle.id)),true,theme.key);
  }
});

test('existing Featured programme copy adopts current capacity language without replacing custom text',()=>{
  const migration=fs.readFileSync(path.join(root,'supabase','migrations','064_current_capacity_language.sql'),'utf8');
  assert.match(migration,/replace\(public_introduction,'Truck Market','Open capacity'\)/i);
  assert.match(migration,/where public_introduction like '%Truck Market%'/i);
  assert.doesNotMatch(migration,/delete|truncate|drop\s/i);
});

test('managed import keeps Open capacity larger than each explicitly shared demo map',()=>{
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'resources','fixtures','managed-market.json'),'utf8'));
  const {capacities,vehicles}=fixture.tables;
  const vehicleById=new Map(vehicles.map(vehicle=>[vehicle.id,vehicle]));
  const managed=applyManagedFixtureMarketPolicy(capacities,vehicles);
  assert.equal(managed.filter(capacity=>SMALL_LOCAL_VEHICLE_CONFIGURATIONS.has(
    vehicleById.get(capacity.vehicle_id)?.cargo_configuration
  )).every(capacity=>capacity.location_precision_km<=5),true);
  const publicCapacity=managed.filter(capacity=>capacity.visibility==='OPEN');
  const privateCapacity=managed.filter(capacity=>capacity.visibility==='PRIVATE');
  const longHaul=managed.filter(capacity=>LONG_HAUL_VEHICLE_CONFIGURATIONS
    .has(vehicleById.get(capacity.vehicle_id)?.cargo_configuration));
  assert.equal(longHaul.length,25);
  assert.equal(longHaul.every(capacity=>capacity.market_status==='EMPTY'&&capacity.status==='EMPTY'
    &&capacity.available_percent===100&&capacity.visibility==='OPEN'),true);
  assert.ok(publicCapacity.length>privateCapacity.length);
  assert.equal(publicCapacity.filter(capacity=>capacity.market_status==='PARTIAL').length,35);
  assert.ok(publicCapacity.filter(capacity=>capacity.market_status==='EMPTY').length>15);

  const shared=selectSharedFixtureVehicleIds(managed);
  assert.equal(shared.size,Math.ceil(vehicles.length*.25));
  assert.ok(shared.size<publicCapacity.length);
  assert.equal([...shared].every(vehicleId=>vehicleById.has(vehicleId)),true);
  assert.deepEqual(normalizeDemoSharedEmails('TEST@example.com, test@example.com,second@example.com'),
    ['test@example.com','second@example.com']);
  assert.throws(()=>normalizeDemoSharedEmails('not-an-email'),/DEMO_SHARED_EMAIL_INVALID/);
});

test('Shared capacity verification chooses an unexpired market signal',()=>{
  const source=fs.readFileSync(path.join(root,'scripts','verify-supabase-shared-capacity.mjs'),'utf8');
  assert.match(source,/\.in\('market_status',\['EMPTY','PARTIAL'\]\)/);
  assert.match(source,/\.gt\('expires_at',new Date\(\)\.toISOString\(\)\)/);
});

test('fixture importer refuses a remote Supabase target before making requests',()=>{
  const result=spawnSync(process.execPath,[importer,'--reset-local'],{
    cwd:root,
    env:{...process.env,SUPABASE_SEED_URL:'https://example.supabase.co',SUPABASE_SEED_SERVICE_ROLE_KEY:'not-a-secret'},
    encoding:'utf8'
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/REMOTE_FIXTURE_IMPORT_REFUSED/);
});

test('fixture importer requires an explicit destructive local reset flag',()=>{
  const result=spawnSync(process.execPath,[importer],{
    cwd:root,
    env:{...process.env,SUPABASE_SEED_URL:'http://127.0.0.1:55321',SUPABASE_SEED_SERVICE_ROLE_KEY:'not-a-secret'},
    encoding:'utf8'
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/LOCAL_FIXTURE_RESET_CONFIRMATION_REQUIRED/);
});

test('fixture importer refuses Production even when a loopback target is supplied',()=>{
  const result=spawnSync(process.execPath,[importer,'--reset-local'],{
    cwd:root,
    env:{
      ...process.env,NODE_ENV:'production',SUPABASE_SEED_URL:'http://127.0.0.1:55321',
      SUPABASE_SEED_SERVICE_ROLE_KEY:'not-a-secret'
    },
    encoding:'utf8'
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/PRODUCTION_FIXTURE_IMPORT_REFUSED/);
});

test('runtime parity migrations preserve area routes and least-privilege RLS enforcement',()=>{
  const routeConstraint=fs.readFileSync(path.join(root,'supabase','migrations','036_profile_route_geometry_constraint.sql'),'utf8');
  const privileges=fs.readFileSync(path.join(root,'supabase','migrations','035_runtime_role_privileges.sql'),'utf8');
  assert.match(routeConstraint,/geometry\s*=\s*'RADIUS'/);
  assert.match(routeConstraint,/lower\(trim\(origin\)\)\s*<>\s*lower\(trim\(destination\)\)/);
  assert.match(privileges,/revoke all privileges on all tables in schema public from anon/i);
  assert.doesNotMatch(privileges,/grant .* on all tables in schema public to anon/i);
  assert.match(privileges,/PostGIS metadata relations/);
});

test('managed identity projection binds its subject to auth uid and exposes no password material',()=>{
  const identity=fs.readFileSync(path.join(root,'supabase','migrations','037_current_user_identity_projection.sql'),'utf8');
  assert.match(identity,/where profile\.id=auth\.uid\(\)/i);
  assert.match(identity,/revoke all on function public\.current_user_projection\(\) from public,anon/i);
  assert.match(identity,/grant execute on function public\.current_user_projection\(\) to authenticated,service_role/i);
  assert.doesNotMatch(identity,/password|token|secret/i);
});

test('public capacity migration is bounded, server-only, and strips private current geometry',()=>{
  const capacity=fs.readFileSync(path.join(root,'supabase','migrations','038_public_capacity_projection.sql'),'utf8');
  assert.match(capacity,/greatest\(12,least\(coalesce\(requested_page_size,14\),16\)\)/i);
  assert.match(capacity,/case when visibility='OPEN' then location_lat end/i);
  assert.match(capacity,/case when visibility='OPEN' then current_route_points_json else '\[\]'::jsonb end/i);
  assert.match(capacity,/position\(input\.search_text in lower/i);
  assert.match(capacity,/capacity_route_matches\(signal->'route_points'/i);
  assert.match(capacity,/capacity_area_matches\(signal->'area_boundary'/i);
  assert.match(capacity,/revoke all on function public\.public_capacity_page[\s\S]*from public,anon,authenticated/i);
  assert.match(capacity,/grant execute on function public\.public_capacity_page[\s\S]*to service_role/i);
});

test('public application adapter excludes private trucks instead of placing regular-service fallbacks',()=>{
  const repository=fs.readFileSync(path.join(root,'src','lib','repository','supabase.js'),'utf8');
  const projection=repository.slice(repository.indexOf('export async function listSupabasePublicCapacityCursor'),repository.indexOf('function managedCapacityError'));
  assert.match(projection,/filter\(row=>row\.current_signal_geometry_visible!==false\)/);
  assert.doesNotMatch(projection,/regularServicePoint|not current location/);
});

test('active capacity remains discoverable until an explicit Off Duty update',()=>{
  const retention=fs.readFileSync(path.join(root,'supabase','migrations','063_active_capacity_until_off_duty.sql'),'utf8');
  const verifier=fs.readFileSync(path.join(root,'scripts','verify-supabase-fixtures.mjs'),'utf8');
  assert.match(retention,/coalesce\(new\.market_status,new\.status::text\) in \('EMPTY','PARTIAL'\)/i);
  assert.match(retention,/new\.expires_at='infinity'::timestamptz/i);
  assert.match(retention,/before insert or update of status,market_status,expires_at/i);
  assert.match(retention,/revoke all on function public\.retain_active_capacity_until_off_duty\(\) from public,anon,authenticated/i);
  assert.match(verifier,/SUPABASE_FIXTURE_VERIFY_EXPIRED_LATEST_HIDDEN/);
  assert.doesNotMatch(verifier,/SUPABASE_FIXTURE_VERIFY_HISTORICAL_CAPACITY_EXPOSED/);
});

test('public provider review summary is aggregate-only and server-only',()=>{
  const provider=fs.readFileSync(path.join(root,'supabase','migrations','039_public_provider_review_summary.sql'),'utf8');
  assert.match(provider,/jsonb_build_object\([\s\S]*'review_count',count\(\*\)::integer[\s\S]*'average_rating'/i);
  assert.match(provider,/where review\.status='PUBLISHED'/i);
  assert.match(provider,/security definer/i);
  assert.match(provider,/revoke all on function public\.public_provider_review_summary\(uuid,uuid\) from public,anon,authenticated/i);
  assert.match(provider,/grant execute on function public\.public_provider_review_summary\(uuid,uuid\) to service_role/i);
  assert.doesNotMatch(provider,/shipper|receiver|email|phone|note/i);
});

test('Daily Featured candidate projection rechecks eligibility and is server-only',()=>{
  const featured=fs.readFileSync(path.join(root,'supabase','migrations','040_public_featured_candidates.sql'),'utf8');
  assert.match(featured,/page\.base_region_code=any/i);
  assert.match(featured,/candidate\.base_place_ref is not null/i);
  assert.match(featured,/count\(distinct vehicle\.id\)/i);
  assert.match(featured,/request\.verification_type='BUSINESS_ADDRESS'/i);
  assert.match(featured,/request\.verification_type='VEHICLE_AUTHORIZATION'/i);
  assert.match(featured,/revoke all on function public\.public_featured_provider_candidates\(text\[\]\) from public,anon,authenticated/i);
  assert.match(featured,/grant execute on function public\.public_featured_provider_candidates\(text\[\]\) to service_role/i);
  assert.doesNotMatch(featured,/storage_path|original_name|mime_type|review_note|dispute_reason/i);
});

test('Shared capacity runtime is server-only, actor-scoped, and never projects recipient secrets',()=>{
  const shared=fs.readFileSync(path.join(root,'supabase','migrations','042_shared_capacity_runtime.sql'),'utf8');
  assert.match(shared,/private_capacity_actor_controls_vehicle\(actor_user_id,target_vehicle_id\)/i);
  assert.match(shared,/membership\.membership_role='OWNER'/i);
  assert.match(shared,/assignment\.driver_user_id=actor\.id[\s\S]*assignment\.active/i);
  assert.match(shared,/support\.can_manage_operations/i);
  assert.match(shared,/challenge\.attempt_count>=5/i);
  assert.match(shared,/set attempt_count=least\(5,attempt_count\+1\)/i);
  assert.match(shared,/challenge_expires_at>now\(\)\+interval '10 minutes 5 seconds'/i);
  assert.match(shared,/for update skip locked/i);
  assert.match(shared,/next_attempt_at=now\(\)\+interval '10 minutes'/i);
  assert.match(shared,/if delivery\.status='SENT' then return true/i);
  assert.match(shared,/grant_record\.recipient_email_digest=requested_digest/i);
  assert.match(shared,/current_signal_geometry_visible',true/i);
  assert.match(shared,/cursor_updated_at is null[\s\S]*capacity\.updated_at<cursor_updated_at/i);
  assert.match(shared,/limit greatest\(2,least\(coalesce\(requested_page_size,100\),100\)\+1\)/i);
  assert.match(shared,/revoke all on function public\.private_capacity_projection\(text,text,uuid,timestamptz,uuid,integer\) from public,anon,authenticated/i);
  assert.match(shared,/grant execute on function public\.private_capacity_projection\(text,text,uuid,timestamptz,uuid,integer\) to service_role/i);
  const projection=shared.slice(shared.indexOf('create or replace function public.private_capacity_projection'),shared.indexOf('create or replace function public.pending_access_email_deliveries'));
  assert.doesNotMatch(projection,/'recipient_email'|'recipient_email_digest'|'code_digest'|'plate'/i);
});
