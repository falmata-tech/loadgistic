import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const importer=path.join(root,'scripts','import-supabase-fixtures.mjs');

test('local managed signup verification uses only the isolated mail sink and numeric signup OTP',()=>{
  const configure=fs.readFileSync(path.join(root,'scripts','configure-local-supabase.mjs'),'utf8');
  const verifier=fs.readFileSync(path.join(root,'scripts','verify-supabase-provider-signup.mjs'),'utf8');
  const localConfig=fs.readFileSync(path.join(root,'supabase','config.toml'),'utf8');
  assert.match(configure,/INBUCKET_URL\|\|runtime\.MAILPIT_URL/);
  assert.match(configure,/SUPABASE_SEED_MAIL_URL:mailUrl/);
  assert.match(configure,/--verify-signup/);
  assert.match(configure,/APP_URL','http:\/\/127\.0\.0\.1:3100'/);
  assert.match(localConfig,/site_url = "http:\/\/127\.0\.0\.1:3100"/);
  assert.match(verifier,/REMOTE_SIGNUP_MAIL_VERIFY_REFUSED/);
  assert.match(verifier,/verifyOtp\(\{email:otpEmail,token:code,type:'signup'\}\)/);
  assert.match(verifier,/verifyOtp\(\{email:otpEmail,token:code,type:'email'\}\)/);
});

test('fixture importer uses a credential-free managed source and creates the current Ethiopia Featured day',()=>{
  const source=fs.readFileSync(importer,'utf8');
  const fixturePath=path.join(root,'resources','fixtures','managed-market.json');
  const fixtureText=fs.readFileSync(fixturePath,'utf8');
  const fixture=JSON.parse(fixtureText);
  assert.match(source,/managed-market\.json/);
  assert.match(source,/regionalExpoGroupForDate\(today\)/);
  assert.match(source,/buildFeaturedFixtureTables\(\)/);
  assert.match(source,/timeZone:'Africa\/Addis_Ababa'/);
  assert.doesNotMatch(source,/node:sqlite|DATABASE_PATH|db\.js|repository\.js/);
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
