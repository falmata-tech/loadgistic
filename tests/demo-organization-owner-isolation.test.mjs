import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const migration=read('supabase/migrations/225_demo_organization_owner_isolation.sql');
const definitions=[
 {name:'demo_world_execute_profile',path:'197_demo_world_provider_profile_copy_v2.sql',hash:'4c78a57bb111bf895a525f31cfd7eb4f'},
 {name:'demo_world_tracking_lifecycle_actor_ready',path:'191_demo_world_tracking_lifecycle_reservation.sql',hash:'5b01d86bd497eadbf363b413b4c8b919'},
 {name:'demo_world_tracking_live_actor_ready',path:'194_demo_world_tracking_live_reservation.sql',hash:'5b01d86bd497eadbf363b413b4c8b919'}
].map(item=>{
 const source=read(`supabase/migrations/${item.path}`);
 const definition=source.match(new RegExp(`create (?:or replace )?function public\\.${item.name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`));
 assert.ok(definition,`${item.name}: authoritative final source exists`);
 return {...item,definition:definition[0],body:definition[1]};
});
const edits=[...migration.matchAll(/anchor:=\$old\$([\s\S]*?)\$old\$;\s*replacement:=\$new\$([\s\S]*?)\$new\$;/g)]
 .map(([,anchor,replacement])=>({anchor,replacement}));
function patchedDefinition(item){
 const applicable=item.name==='demo_world_execute_profile'?edits.slice(0,4):edits.slice(4);
 let source=item.definition;
 for(const {anchor,replacement} of applicable){
  assert.equal(source.split(anchor).length-1,1,`${item.name}: exact single replacement anchor`);
  source=source.replace(anchor,replacement);
 }
 return source;
}
function ordered(source,parts){
 let cursor=-1;
 for(const part of parts){
  const next=source.indexOf(part,cursor+1);
  assert.ok(next>cursor,`ordered guard: ${part}`);cursor=next;
 }
}

test('225 pins the final three definitions and retains function identity and private ACLs',()=>{
 assert.equal(edits.length,5,'all narrow edits are represented');
 for(const item of definitions){
  assert.equal(createHash('md5').update(item.body).digest('hex'),item.hash);
  assert.ok(migration.includes(`'${item.hash}'`));
 }
 for(const proof of ['md5(original.prosrc)<>item.body_md5','not original.prosecdef',
  'original.provolatile::text<>item.volatility','original.lanname<>item.language_name',
  'original.prorettype<>item.return_type::regtype','original.proretset',
  'original.proconfig is distinct from item.configuration',
  "has_function_privilege('anon',original.oid,'EXECUTE')",
  "has_function_privilege('authenticated',original.oid,'EXECUTE')",
  "has_function_privilege('service_role',original.oid,'EXECUTE') is distinct from item.service_execute",
  'after_change.oid<>original.oid','after_change.proowner<>original.proowner',
  'after_change.proacl is distinct from original.proacl','after_change.proconfig is distinct from original.proconfig']){
  assert.ok(migration.includes(proof),proof);
 }
 assert.doesNotMatch(migration,/\b(?:grant|revoke|create table|alter table|insert into|delete from)\b/i);
});

test('profile patch serializes stop controls, preserves DONE replay and bounds owner locks before publication',()=>{
 const item=definitions[0],patched=patchedDefinition(item);
 ordered(patched,[
  "if job_id is null or lease_token is null",
  'from public.demo_world_control where id=1 for share',
  'from public.demo_world_profile_control where id=1 for share',
  'from public.demo_world_profile_jobs where id=job_id for update',
  "if job.state='DONE' then",
  "return jsonb_build_object('result','REPLAYED')",
  'now_value:=clock_timestamp(); -- Refresh after control/job waits and after DONE replay.',
  "if job.copy_version<>2 or job.state<>'LEASED' or job.lease_expires_at<=now_value",
  'where id=1 and enabled and manifest_version=2',
  "select * into before_page from public.company_pages page",
  'where page.id=target.page_id and page.organization_id=target.organization_id for update',
  'where provider.id=target.organization_id for update nowait',
  'where member.organization_id=target.organization_id order by member.id for share nowait',
  'exception when lock_not_available then',
  "member.organization_id=target.organization_id and member.membership_role='OWNER')<>1",
  'and member.user_id=target.actor_id',
  "if before_page.headline is distinct from old_copy->>'headline'",
  "if job.lease_expires_at<=clock_timestamp() then raise exception 'DEMO_PROFILE_LEASE_REFUSED';end if;",
  'saved_id:=public.update_provider_profile_page(target.actor_id',
  'insert into public.demo_world_profile_receipts',
  "update public.demo_world_profile_jobs set state='DONE'"
 ]);
 for(const token of new Set(item.definition.match(/DEMO_PROFILE_[A-Z_]+/g))){
  assert.ok(patched.includes(token),`preserves existing ${token}`);
 }
 const beforeReplay=item.definition.match(/ if job.state='DONE' then[\s\S]*?\n end if;/)[0];
 assert.ok(patched.includes(beforeReplay),'full validated DONE replay is byte-preserved');
});

test('both reserved Tracking readiness helpers require one owner within their existing marked-actor proof',()=>{
 for(const item of definitions.slice(1)){
  const patched=patchedDefinition(item);
  assert.match(patched,/raw_app_meta_data->>'fixture_source' = 'loadgistic'/);
  assert.match(patched,/member\.membership_role = 'OWNER'/);
  assert.match(patched,/and \(select count\(\*\) from public\.organization_members owner_membership\s+where owner_membership\.organization_id=vehicle\.organization_id\s+and owner_membership\.membership_role='OWNER'\)=1/);
  assert.ok(patched.includes('returns boolean language sql stable security definer'));
 }
});

test('rollback suites preserve ordinary and forged co-owner refusals plus disabled completed replay',()=>{
 const profile=read('tests/sql/demo-world-provider-profile.sql');
 for(const marker of ['ISOLATED_DEMO_TEST_DATABASE_REQUIRED','PROFILE_COOWNER_DENIAL_CHANGED_STATE',
  'PROFILE_COOWNER_FIXTURE_ROLLBACK_FAILED','PROFILE_DISABLED_DONE_REPLAY_CHANGED_STATE',
  'PROFILE_DISABLED_REPLAY_FIXTURE_ROLLBACK_FAILED'])assert.ok(profile.includes(marker),marker);
 for(const filename of ['demo-world-provider-profile.sql','demo-world-tracking-lifecycle-reservation.sql','demo-world-tracking-live-reservation.sql']){
  const source=read(`tests/sql/${filename}`);
  assert.match(source,/foreach forged in array array\[false,\s*true\]/);
  assert.match(source,/raw_user_meta_data\s*=\s*jsonb_build_object/);
  for(const table of ['auth.users','public.profiles','public.organization_members','public.vehicles',
   'public.capacities','public.telematics_location_sources','public.vehicle_driver_locations',
   'public.telematics_positions','public.phone_location_bindings','public.telematics_device_assignments',
   'public.vehicle_capacity_sharing','public.business_capacity_grants'])assert.ok(source.includes(table),`${filename} snapshots ${table}`);
  assert.match(source,/rollback;\s*$/i);
 }
});
