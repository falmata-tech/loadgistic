import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {hasPlatformPermission,PLATFORM_PERMISSIONS} from '../src/lib/platform-admin.js';

const root=path.resolve(process.cwd());
const appAdapters=[
  'src/app/admin/featured/page.tsx',
  'src/app/admin/operations/page.tsx',
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

test('the guarded local Supabase verification chain includes platform administration',()=>{
  const source=fs.readFileSync(path.join(root,'scripts/configure-local-supabase.mjs'),'utf8');
  assert.match(source,/runScript\('scripts\/verify-supabase-platform-admin\.mjs'\)/);
});
