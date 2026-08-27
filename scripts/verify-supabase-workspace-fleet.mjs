import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_WORKSPACE_FLEET_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_WORKSPACE_FLEET_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
process.env.DATA_BACKEND='supabase';
process.env.DATABASE_PATH='/dev/null';

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const {getSupabaseFleetDriverPage,updateSupabaseFleetDriverAccess}=await import('../src/lib/fleet/supabase.js');

async function expectRejected(action,code){
  try{await action();}
  catch(error){if(String(error?.message||error).includes(code))return;throw error;}
  throw new Error(`SUPABASE_WORKSPACE_FLEET_EXPECTED_REJECTION_MISSING:${code}`);
}

const startedAt=new Date().toISOString();
const {data:driverRows,error:driverRowsError}=await service.from('drivers')
  .select('user_id,organization_id').eq('active',true).not('user_id','is',null).limit(100);
if(driverRowsError)throw new Error('SUPABASE_WORKSPACE_FLEET_DRIVER_FIXTURE_LOOKUP_FAILED');
let owner=null;let companyDriver=null;
for(const candidate of driverRows||[]){
  const {data:member,error:memberError}=await service.from('organization_members')
    .select('user_id').eq('organization_id',candidate.organization_id).eq('membership_role','OWNER').limit(1).maybeSingle();
  if(memberError)throw new Error('SUPABASE_WORKSPACE_FLEET_OWNER_FIXTURE_LOOKUP_FAILED');
  if(member?.user_id){owner={id:member.user_id};companyDriver={id:candidate.user_id};break;}
}
if(!owner||!companyDriver)throw new Error('SUPABASE_WORKSPACE_FLEET_ACTORS_MISSING');
const page=await getSupabaseFleetDriverPage(owner,{page:1,pageSize:10});
if(!page.items.length||page.total<page.items.length)throw new Error('SUPABASE_WORKSPACE_FLEET_PAGE_INVALID');
const driver=page.items.find(item=>item.assigned_vehicle_id)||page.items[0];
if(!driver?.id)throw new Error('SUPABASE_WORKSPACE_FLEET_DRIVER_MISSING');
const projected=JSON.stringify(driver);
if(projected.includes('storage_path')||projected.includes('@loadgistic.local')){
  throw new Error('SUPABASE_WORKSPACE_FLEET_PRIVATE_PROJECTION');
}

await updateSupabaseFleetDriverAccess(owner,driver.id,{
  vehicleId:driver.assigned_vehicle_id||'',
  canManageCapacity:Boolean(driver.can_manage_capacity),
  canManageTracking:Boolean(driver.can_manage_tracking)
});
const after=await getSupabaseFleetDriverPage(owner,{page:1,pageSize:10});
const updated=after.items.find(item=>item.id===driver.id);
if(!updated||updated.assigned_vehicle_id!==driver.assigned_vehicle_id
  ||Boolean(updated.can_manage_capacity)!==Boolean(driver.can_manage_capacity)
  ||Boolean(updated.can_manage_tracking)!==Boolean(driver.can_manage_tracking)){
  throw new Error('SUPABASE_WORKSPACE_FLEET_ATOMIC_UPDATE_FAILED');
}

const {data:dashboard,error:dashboardError}=await service.rpc('workspace_dashboard',{actor_user_id:owner.id});
if(dashboardError||!dashboard?.counts||!Array.isArray(dashboard.recent)){
  throw new Error('SUPABASE_WORKSPACE_DASHBOARD_INVALID');
}
await expectRejected(()=>updateSupabaseFleetDriverAccess(companyDriver,driver.id,{
  vehicleId:driver.assigned_vehicle_id||'',canManageCapacity:true,canManageTracking:true
}),'FORBIDDEN');

const {error:anonymousPageError}=await anon.rpc('fleet_driver_page',{
  actor_user_id:owner.id,requested_offset:0,requested_limit:10
});
if(!anonymousPageError)throw new Error('SUPABASE_WORKSPACE_FLEET_ANONYMOUS_PAGE_ALLOWED');
const {error:anonymousUpdateError}=await anon.rpc('update_fleet_driver_access',{
  actor_user_id:owner.id,command:{driver_user_id:driver.id,vehicle_id:'',can_manage_capacity:false,can_manage_tracking:false}
});
if(!anonymousUpdateError)throw new Error('SUPABASE_WORKSPACE_FLEET_ANONYMOUS_UPDATE_ALLOWED');

const {data:audit,error:auditError}=await service.from('audit_logs').select('id,details')
  .eq('actor_user_id',owner.id).eq('action','DRIVER_ACCESS_UPDATED').gte('created_at',startedAt);
if(auditError||!audit?.length)throw new Error('SUPABASE_WORKSPACE_FLEET_AUDIT_MISSING');
const auditText=JSON.stringify(audit.map(entry=>entry.details));
if(auditText.includes('@')||driver.phone&&auditText.includes(driver.phone)){
  throw new Error('SUPABASE_WORKSPACE_FLEET_AUDIT_CONTACT_LEAK');
}
await service.from('audit_logs').delete().in('id',audit.map(entry=>entry.id));

process.stdout.write('Supabase workspace dashboard, bounded Fleet page, atomic owner update, audit privacy, and browser denial checks passed.\n');
