import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import path from 'node:path';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_WORKSPACE_FLEET_VERIFY_CONFIG_MISSING');
if(!new Set(['127.0.0.1','localhost','::1']).has(new URL(url).hostname))throw new Error('REMOTE_WORKSPACE_FLEET_VERIFY_REFUSED');
process.env.NEXT_PUBLIC_SUPABASE_URL=url;process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
const options={auth:{autoRefreshToken:false,persistSession:false}};
const service=createClient(url,serviceRoleKey,options),anon=createClient(url,anonKey,options);
const {getSupabaseFleetDriverPage,updateSupabaseFleetDriverAccess}=await import('../src/lib/fleet/supabase.js');
const {createSupabaseProviderVehicle,setSupabaseProviderVehicleAttachedTrailer}=await import('../src/lib/fleet/vehicles-supabase.js');

async function rpc(name,args){const {data,error}=await service.rpc(name,args);if(error)throw new Error(`FLEET_VERIFY_RPC_FAILED:${name}`);return data;}
async function checked(result,code){const {data,error}=await result;if(error)throw new Error(code);return data;}
async function denied(action,code){try{await action();}catch(error){if(String(error?.message).includes(code))return;throw error;}throw new Error(`FLEET_VERIFY_DENIAL_MISSING:${code}`);}
function ensure(value,code){if(!value)throw new Error(code);}

// Every mutable fixture has a generated identity. Never remove another test's
// audits by timestamp or modify a pre-existing driver's operational permissions.
const nonce=randomUUID(),organizationId=randomUUID(),personalProviderId=randomUUID(),otherProviderId=randomUUID();
const users=[],vehicles=[];const manifestDirectory=path.resolve(import.meta.dirname,'../.local');
mkdirSync(manifestDirectory,{recursive:true});const manifest=path.join(manifestDirectory,`fleet-verifier-${nonce}.json`);
function record(){writeFileSync(manifest,JSON.stringify({purpose:'local-fleet-verifier',nonce,userIds:users,vehicleIds:vehicles,organizationId,providerIds:[personalProviderId,otherProviderId]}),{mode:0o600});}
record();
async function identity(label){
 const result=await service.auth.admin.createUser({email:`fleet-${label}-${nonce}@example.test`,email_confirm:true});
 ensure(!result.error&&result.data.user?.id,'FLEET_VERIFY_IDENTITY_CREATE_FAILED');
 users.push(result.data.user.id);record();return {id:result.data.user.id,email:result.data.user.email};
}
async function truck(actor,plate,basis='OWNED',extra={}){
 const created=await createSupabaseProviderVehicle(actor,{make:'Synthetic',model:'Fleet verifier',plate,cargoConfiguration:'Cargo van',useBasis:basis,...extra});
 ensure(created?.id&&String(created.platform_number).startsWith('LG-TRK-'),'FLEET_VERIFY_TRUCK_RESPONSE');
 vehicles.push(created.id);record();
 const stored=await checked(service.from('vehicles').select('organization_id,provider_profile_id,active,publication_status,use_basis').eq('id',created.id).single(),'FLEET_VERIFY_TRUCK_READ');
 ensure(stored.active&&stored.publication_status==='DRAFT'&&stored.use_basis===basis,'FLEET_VERIFY_PRIVATE_DRAFT');
 const counts=await Promise.all(['capacities','driver_vehicle_assignments'].map(table=>service.from(table).select('id',{count:'exact',head:true}).eq('vehicle_id',created.id)));
 ensure(counts.every(result=>!result.error&&result.count===0),'FLEET_VERIFY_REGISTRATION_INFERRED_STATE');
 return {...created,stored};
}
let failure;
try{
 const owner=await identity('business'),personal=await identity('personal'),employee=await identity('employee'),outsider=await identity('outsider');
 await checked(service.from('profiles').update({active:true,role:'TRANSPORTER',drives_truck:true}).eq('id',owner.id),'FLEET_VERIFY_BUSINESS_PROFILE');
 await checked(service.from('profiles').update({active:true,role:'DRIVER',drives_truck:true}).in('id',[personal.id,outsider.id]),'FLEET_VERIFY_PERSONAL_PROFILE');
 await checked(service.from('organizations').insert({id:organizationId,name:'Synthetic fleet',handle:`fleet-${nonce}`,type:'TRANSPORT_COMPANY'}),'FLEET_VERIFY_ORGANIZATION');
 await checked(service.from('organization_members').insert({user_id:owner.id,organization_id:organizationId,membership_role:'OWNER'}),'FLEET_VERIFY_MEMBERSHIP');
 await checked(service.from('provider_profiles').insert([
  {id:personalProviderId,user_id:personal.id,business_name:'Synthetic personal provider',handle:`personal-${nonce}`},
  {id:otherProviderId,user_id:outsider.id,business_name:'Synthetic other provider',handle:`other-${nonce}`}
 ]),'FLEET_VERIFY_PERSONAL_PROVIDER');
 const fixed=await truck(owner,'VERIFY-FIXED'),personalOne=await truck(personal,'VERIFY-ONE'),personalTwo=await truck(personal,'VERIFY-TWO','FINANCED');
 ensure(fixed.stored.organization_id===organizationId&&fixed.stored.provider_profile_id===null,'FLEET_VERIFY_ORGANIZATION_ANCHOR');
 ensure(personalOne.stored.provider_profile_id===personalProviderId&&personalOne.stored.organization_id===null&&personalTwo.stored.provider_profile_id===personalProviderId,'FLEET_VERIFY_PERSONAL_MULTIPLE_ANCHOR');
 const registration={email:employee.email,name:'Synthetic employee',phone:'+251900000001'};
 await rpc('fleet_register_driver',{actor_user_id:personal.id,target_user_id:employee.id,command:registration});
 const employeeRow=await checked(service.from('drivers').select('provider_profile_id,organization_id').eq('user_id',employee.id).single(),'FLEET_VERIFY_EMPLOYEE_READ');
 ensure(employeeRow.provider_profile_id===personalProviderId&&employeeRow.organization_id===null,'FLEET_VERIFY_EMPLOYER_SCOPE');
 const employeeCaps=await rpc('provider_account_capabilities',{actor_user_id:employee.id});
 ensure(employeeCaps.drives_truck===true&&employeeCaps.owns_provider_account===false&&employeeCaps.can_manage_fleet===false,'FLEET_VERIFY_EMPLOYEE_CAPABILITIES');
 await denied(()=>createSupabaseProviderVehicle(employee,{make:'Synthetic',model:'Denied',plate:'DENIED',cargoConfiguration:'Cargo van',useBasis:'OWNED'}),'FORBIDDEN');
 await denied(()=>createSupabaseProviderVehicle(owner,{make:'Synthetic',model:'Invalid',plate:'INVALID',cargoConfiguration:'Imaginary truck',useBasis:'OWNED'}),'INVALID_VEHICLE_CONFIGURATION');
 await denied(()=>createSupabaseProviderVehicle(owner,{make:'Synthetic',model:'Invalid',plate:'INVALID',cargoConfiguration:'Cargo van'}),'INVALID_VEHICLE_USE_BASIS');
 const configurations=['Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'];
 const tractor=await truck(owner,'VERIFY-TRACTOR','PERMISSION',{cargoConfiguration:configurations[0],trailerInterchangeable:true,supportedTrailerConfigurations:configurations});
 const switched=await setSupabaseProviderVehicleAttachedTrailer(owner,tractor.id,configurations[1]);
 ensure(switched?.id===tractor.id&&switched.cargo_configuration===configurations[1],'FLEET_VERIFY_TRAILER_SWITCH');
 await denied(()=>setSupabaseProviderVehicleAttachedTrailer(owner,tractor.id,'Heavy Rigid Stake Body Truck + Trailer'),'INCOMPATIBLE_TRAILER_CONFIGURATION');
 await denied(()=>setSupabaseProviderVehicleAttachedTrailer(owner,fixed.id,configurations[0]),'NOT_INTERCHANGEABLE_TRACTOR');
 await denied(()=>setSupabaseProviderVehicleAttachedTrailer(employee,tractor.id,configurations[2]),'FORBIDDEN');
 const assignment={vehicleId:personalOne.id,canManageCapacity:true,canManageTracking:true};
 await updateSupabaseFleetDriverAccess(personal,employee.id,assignment);
 const page=await getSupabaseFleetDriverPage(personal,{page:1,pageSize:10});
 ensure(page.items.some(row=>row.id===personal.id&&row.is_owner===true)&&page.items.some(row=>row.id===employee.id&&row.is_owner===false&&row.assigned_vehicle_id===personalOne.id),'FLEET_VERIFY_OWNER_AND_EMPLOYEE_PAGE');
 ensure(!JSON.stringify(page).includes('storage_path'),'FLEET_VERIFY_PRIVATE_STORAGE_LEAK');
 await updateSupabaseFleetDriverAccess(personal,employee.id,assignment);
 const after=await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',personalOne.id);
 ensure(!after.error,'FLEET_VERIFY_SNAPSHOT_READ');
 // Repeating the same pair does not manufacture another availability snapshot.
 const capacityRows=await checked(service.from('capacities').select('id').eq('vehicle_id',personalOne.id),'FLEET_VERIFY_SNAPSHOT_READ');
 ensure(capacityRows.length===1&&after.count===1,'FLEET_VERIFY_SAME_PAIR_RESET');
 await updateSupabaseFleetDriverAccess(personal,employee.id,{...assignment,vehicleId:personalTwo.id});
 const active=await checked(service.from('driver_vehicle_assignments').select('vehicle_id').eq('driver_user_id',employee.id).eq('active',true),'FLEET_VERIFY_CURRENT_PAIR_READ');
 ensure(active.length===1&&active[0].vehicle_id===personalTwo.id,'FLEET_VERIFY_ONE_CURRENT_PAIR');
 const latest=await checked(service.from('capacities').select('market_status,location_lat,location_lng').eq('vehicle_id',personalTwo.id).order('updated_at',{ascending:false}).limit(1).single(),'FLEET_VERIFY_RESET_READ');
 ensure(latest.market_status==='OFF_DUTY'&&latest.location_lat===null&&latest.location_lng===null,'FLEET_VERIFY_NEW_PAIR_FRESH_REPORT');
 await denied(()=>updateSupabaseFleetDriverAccess(employee,employee.id,assignment),'FORBIDDEN');
 await denied(()=>updateSupabaseFleetDriverAccess(outsider,employee.id,assignment),'NOT_FOUND');
 const dashboard=await rpc('workspace_dashboard',{actor_user_id:personal.id});
 ensure(dashboard?.counts&&Array.isArray(dashboard.recent),'FLEET_VERIFY_DASHBOARD');
 for(const [name,args]of[
  ['fleet_driver_page',{actor_user_id:personal.id,requested_offset:0,requested_limit:10}],
  ['update_fleet_driver_access',{actor_user_id:personal.id,command:{driver_user_id:employee.id,vehicle_id:''}}],
  ['create_provider_vehicle',{actor_user_id:personal.id,command:{}}],
  ['set_provider_vehicle_attached_trailer',{actor_user_id:owner.id,command:{vehicle_id:tractor.id,cargo_configuration:configurations[2]}}]
 ])ensure((await anon.rpc(name,args)).error,`FLEET_VERIFY_BROWSER_RPC_ALLOWED:${name}`);
 const audit=await checked(service.from('audit_logs').select('details').in('actor_user_id',users).eq('action','DRIVER_ACCESS_UPDATED'),'FLEET_VERIFY_AUDIT_READ');
 ensure(audit.length===3&&!JSON.stringify(audit).includes('@')&&!JSON.stringify(audit).includes(registration.phone),'FLEET_VERIFY_AUDIT_PRIVACY');
}catch(error){failure=error;}
finally{
 try{
  if(vehicles.length){
   await checked(service.from('capacities').delete().in('vehicle_id',vehicles),'FLEET_VERIFY_CLEANUP_CAPACITY');
   await checked(service.from('vehicle_capacity_sharing').delete().in('vehicle_id',vehicles),'FLEET_VERIFY_CLEANUP_SHARING');
   await checked(service.from('capacity_access_grants').delete().in('vehicle_id',vehicles),'FLEET_VERIFY_CLEANUP_CONTACTS');
   await checked(service.from('vehicles').delete().in('id',vehicles),'FLEET_VERIFY_CLEANUP_VEHICLES');
  }
  if(users.length){
   for(const[table,column]of[['driver_vehicle_assignments','driver_user_id'],['driver_permissions','user_id'],['fleet_driver_invitations','invited_by'],['drivers','user_id'],['audit_logs','actor_user_id'],['user_policy_acceptances','user_id'],['provider_profiles','user_id'],['organization_members','user_id']]){
    await checked(service.from(table).delete().in(column,users),`FLEET_VERIFY_CLEANUP:${table}`);
   }
   await checked(service.from('organizations').delete().eq('id',organizationId),'FLEET_VERIFY_CLEANUP_ORGANIZATION');
   for(const id of users)ensure(!(await service.auth.admin.deleteUser(id)).error,'FLEET_VERIFY_CLEANUP_IDENTITY');
  }
  unlinkSync(manifest);
 }catch(error){failure=error;}
}
if(failure)throw failure;
process.stdout.write('Provider-owner multi-truck fleets, Draft registration, personal employment, current assignments, reset signals, fixed/interchangeable vehicles, audit privacy and browser denials passed; exact synthetic fixtures removed.\n');
