import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_WORKSPACE_FLEET_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_WORKSPACE_FLEET_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const {getSupabaseFleetDriverPage,updateSupabaseFleetDriverAccess}=await import('../src/lib/fleet/supabase.js');
const {createSupabaseProviderVehicle}=await import('../src/lib/fleet/vehicles-supabase.js');

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
  if(member?.user_id){owner={id:member.user_id,organizationId:candidate.organization_id};companyDriver={id:candidate.user_id};break;}
}
if(!owner||!companyDriver)throw new Error('SUPABASE_WORKSPACE_FLEET_ACTORS_MISSING');
const {data:independent,error:independentError}=await service.from('provider_profiles')
  .select('id,user_id').not('user_id','is',null).limit(1).maybeSingle();
if(independentError||!independent?.user_id)throw new Error('SUPABASE_WORKSPACE_FLEET_INDEPENDENT_ACTOR_MISSING');
const createdVehicleIds=[];
for(const [actor,expectedOwner] of [[owner,{organization_id:owner.organizationId,provider_profile_id:null}],[{id:independent.user_id},{organization_id:null,provider_profile_id:independent.id}]]){
  const created=await createSupabaseProviderVehicle(actor,{
    make:'Test',model:'Verifier',cargoConfiguration:'Cargo van',plate:`VERIFY-${createdVehicleIds.length+1}`
  });
  if(!created?.id||!String(created.platform_number||'').startsWith('LG-TRK-'))throw new Error('SUPABASE_WORKSPACE_FLEET_VEHICLE_CREATE_INVALID');
  createdVehicleIds.push(created.id);
  const {data:stored,error:storedError}=await service.from('vehicles')
    .select('organization_id,provider_profile_id,active').eq('id',created.id).single();
  if(storedError||!stored.active)throw new Error('SUPABASE_WORKSPACE_FLEET_VEHICLE_NOT_STORED');
  if(expectedOwner.organization_id&&stored.organization_id!==expectedOwner.organization_id)throw new Error('SUPABASE_WORKSPACE_FLEET_ORGANIZATION_OWNERSHIP_WRONG');
  if(expectedOwner.provider_profile_id&&stored.provider_profile_id!==expectedOwner.provider_profile_id)throw new Error('SUPABASE_WORKSPACE_FLEET_INDEPENDENT_OWNERSHIP_WRONG');
  const {count:capacityCount,error:capacityError}=await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',created.id);
  const {count:assignmentCount,error:assignmentError}=await service.from('driver_vehicle_assignments').select('id',{count:'exact',head:true}).eq('vehicle_id',created.id);
  if(capacityError||assignmentError||capacityCount!==0||assignmentCount!==0)throw new Error('SUPABASE_WORKSPACE_FLEET_REGISTRATION_INFERRED_STATE');
}
await expectRejected(()=>createSupabaseProviderVehicle(companyDriver,{make:'Test',model:'Denied',cargoConfiguration:'Cargo van',plate:'DENIED'}),'FORBIDDEN');
await expectRejected(()=>createSupabaseProviderVehicle(owner,{make:'Test',model:'Invalid',cargoConfiguration:'Imaginary truck',plate:'INVALID'}),'INVALID_VEHICLE_CONFIGURATION');
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
const {error:anonymousCreateError}=await anon.rpc('create_provider_vehicle',{
  actor_user_id:owner.id,command:{make:'Test',model:'Denied',cargo_configuration:'Cargo van',plate:'DENIED'}
});
if(!anonymousCreateError)throw new Error('SUPABASE_WORKSPACE_FLEET_ANONYMOUS_CREATE_ALLOWED');

const {data:audit,error:auditError}=await service.from('audit_logs').select('id,details')
  .eq('actor_user_id',owner.id).eq('action','DRIVER_ACCESS_UPDATED').gte('created_at',startedAt);
if(auditError||!audit?.length)throw new Error('SUPABASE_WORKSPACE_FLEET_AUDIT_MISSING');
const auditText=JSON.stringify(audit.map(entry=>entry.details));
if(auditText.includes('@')||driver.phone&&auditText.includes(driver.phone)){
  throw new Error('SUPABASE_WORKSPACE_FLEET_AUDIT_CONTACT_LEAK');
}
await service.from('audit_logs').delete().gte('created_at',startedAt);
if(createdVehicleIds.length)await service.from('vehicles').delete().in('id',createdVehicleIds);

process.stdout.write('Supabase workspace dashboard, bounded Fleet page, owner-scoped truck registration, atomic owner update, audit privacy, and browser denial checks passed.\n');
