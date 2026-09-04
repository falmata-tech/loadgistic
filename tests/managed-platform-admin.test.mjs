import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {hasPlatformPermission,PLATFORM_PERMISSIONS} from '../src/lib/platform-admin.js';

const root=path.resolve(process.cwd());
const appAdapters=[
  'src/app/admin/featured/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/admin/operations/page.tsx',
  'src/app/admin/operations/[view]/[id]/page.tsx',
  'src/app/api/admin/featured/route.ts',
  'src/app/api/admin/records/[type]/[id]/route.ts',
  'src/app/api/admin/workspaces/[id]/sponsor/route.ts'
];

test('active platform admin adapters use the managed port without SQLite repository imports',()=>{
  for(const relative of appAdapters){
    const source=fs.readFileSync(path.join(root,relative),'utf8');
    assert.doesNotMatch(source,/lib\/repository(?:\.js)?['"]/);
    assert.match(source,/lib\/platform-admin\.js/);
  }
});

test('platform permission presentation stays least privilege before the database recheck',()=>{
  assert.equal(hasPlatformPermission({role:'ADMIN'},PLATFORM_PERMISSIONS.BILLING),true);
  assert.equal(hasPlatformPermission({role:'SUPPORT',can_manage_customers:true},PLATFORM_PERMISSIONS.CUSTOMERS),true);
  assert.equal(hasPlatformPermission({role:'SUPPORT',can_manage_customers:true},PLATFORM_PERMISSIONS.OPERATIONS),false);
  assert.equal(hasPlatformPermission({role:'DRIVER',can_manage_operations:true},PLATFORM_PERMISSIONS.OPERATIONS),false);
});

test('managed admin migration grants only the service role and excludes private projection fields',()=>{
  const source=fs.readFileSync(path.join(root,'supabase/migrations/057_managed_platform_admin.sql'),'utf8');
  for(const signature of [
    'managed_admin_operations_page(uuid,text,text,integer,integer)',
    'managed_admin_record_command(uuid,text,uuid,jsonb)',
    'managed_admin_featured_day(uuid,date,text,text[])',
    'save_managed_featured_day(uuid,jsonb)',
    'save_managed_sponsorship(uuid,jsonb)'
  ]){
    assert.match(source,new RegExp(`revoke all on function public\\.${signature.replace(/[()[\]]/g,'\\$&')} from public,anon,authenticated`));
  }
  const projection=source.slice(source.indexOf('create or replace function public.managed_admin_operations_page'),source.indexOf('create or replace function public.managed_admin_record_command'));
  for(const privateField of ['storage_path','code_hash','tracking_token','location_lat','location_lng','password']){
    assert.equal(projection.includes(privateField),false,`${privateField} entered the admin projection`);
  }
});

test('featured truck migration saves exact truck and Driver selections through a service-role-only command',()=>{
  const source=fs.readFileSync(path.join(root,'supabase/migrations/069_daily_featured_trucks.sql'),'utf8');
  assert.match(source,/add column if not exists vehicle_id uuid references public\.vehicles/);
  assert.match(source,/add column if not exists driver_user_id uuid references public\.profiles/);
  assert.match(source,/idx_featured_slot_day_vehicle/);
  assert.match(source,/drop index if exists public\.idx_featured_slot_day_org/);
  assert.match(source,/drop function if exists public\.save_managed_featured_day\(uuid,jsonb\)/);
  assert.match(source,/07:30[\s\S]*09:00/);
  assert.match(source,/revoke all on function public\.save_managed_featured_truck_day\(uuid,jsonb\) from public,anon,authenticated/);
  assert.match(source,/grant execute on function public\.save_managed_featured_truck_day\(uuid,jsonb\) to service_role/);
});

test('managed admin detail projection is bounded, permissioned, and secret-free',()=>{
  const source=fs.readFileSync(path.join(root,'supabase/migrations/066_provider_vehicle_registration_and_admin_details.sql'),'utf8');
  assert.match(source,/managed_admin_operation_record\(uuid,text,uuid,text\)/);
  assert.match(source,/managed_actor_has_permission\(actor_user_id,required_permission\)/);
  assert.match(source,/limit 50/);
  assert.match(source,/revoke all on function public\.managed_admin_operation_record\(uuid,text,uuid,text\) from public,anon,authenticated/);
  const projection=source.slice(source.indexOf('create or replace function public.managed_admin_operation_record'));
  for(const privateField of ["'code_hash'","'tracking_token'","'location_lat'","'location_lng'","'recipient_email'","'proof_storage_path'","'password'"]){
    assert.equal(projection.includes(privateField),false,`${privateField} entered the admin detail projection`);
  }
});

test('administration overview counts every records inventory without browser RPC access',()=>{
  const source=fs.readFileSync(path.join(root,'supabase/migrations/067_admin_overview_counts.sql'),'utf8');
  for(const count of ["'users'","'workspaces'","'trucks'","'drivers'","'tracking'","'board_capacity'","'routes'","'subscriptions'"]){
    assert.match(source,new RegExp(count));
  }
  assert.match(source,/revoke all on function public\.managed_admin_operation_counts\(uuid\) from public,anon,authenticated/);
});

test('operations rows use real record routes and active UI contains no fake hash links',()=>{
  const operations=fs.readFileSync(path.join(root,'src/app/admin/operations/page.tsx'),'utf8');
  assert.match(operations,/function recordHref/);
  assert.match(operations,/Open tracking/i);
  const pending=['src'];
  while(pending.length){
    const relative=pending.pop();
    for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
      const child=path.join(relative,entry.name);
      if(entry.isDirectory())pending.push(child);
      else if(/\.(?:tsx|jsx)$/.test(entry.name))assert.doesNotMatch(fs.readFileSync(path.join(root,child),'utf8'),/href=[{]?['"]#['"]/,`${child} contains a fake hash link`);
    }
  }
});

test('the guarded local Supabase verification chain includes platform administration',()=>{
  const source=fs.readFileSync(path.join(root,'scripts/configure-local-supabase.mjs'),'utf8');
  assert.match(source,/runScript\('scripts\/verify-supabase-platform-admin\.mjs'\)/);
});
