import {z} from 'zod';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {verificationBadgesFromApproved,truckAuthorizationBadgeFromApproved} from '../verification-summary.js';

const id=z.string().uuid(),nullableId=id.nullable();
const ownerScope=z.object({organization_id:nullableId,provider_profile_id:nullableId}).refine(row=>Number(Boolean(row.organization_id))+Number(Boolean(row.provider_profile_id))===1);
const profileRow=z.object({id,full_name:z.string().nullable(),public_callback_phone:z.string().nullable(),email:z.string().nullable(),active:z.boolean(),role:z.string(),drives_truck:z.boolean()});
const driverRow=z.object({user_id:id,name:z.string(),phone:z.string().nullable(),organization_id:nullableId,provider_profile_id:nullableId,active:z.boolean()});
const permissionsRow=z.object({can_manage_capacity:z.boolean(),can_manage_tracking:z.boolean()});
const assignmentRows=z.array(z.object({driver_user_id:id,vehicle_id:id,assigned_at:z.string(),active:z.literal(true)})).max(1);
const vehicleRow=z.object({id,make:z.string(),model:z.string(),plate:z.string().nullable(),platform_number:z.string().nullable(),active:z.literal(true),organization_id:nullableId,provider_profile_id:nullableId});
const approvalFields='verification_type,reviewed_at,expires_on,related_vehicle_id';
function fail(error,code='SUPABASE_FLEET_DRIVER_DETAIL_FAILED'){
 throw new Error(String(error?.message||'').includes('FORBIDDEN')?'FORBIDDEN':code);
}
function read(result,schema){if(result.error)fail(result.error);const parsed=schema.safeParse(result.data);if(!parsed.success)fail(null);return parsed.data;}
function sameScope(a,b){return a.organization_id===b.organization_id&&a.provider_profile_id===b.provider_profile_id;}
async function scope(client,actorId){return read(await client.rpc('fleet_provider_owner_scope',{actor_user_id:actorId}),z.array(ownerScope).length(1))[0];}
async function matches(client,targetId,owner){return read(await client.rpc('fleet_driver_matches_scope',{target_driver_id:targetId,owner_org:owner.organization_id,owner_provider:owner.provider_profile_id}),z.boolean());}
async function assignments(client,targetId){
 const result=await client.from('driver_vehicle_assignments').select('driver_user_id,vehicle_id,assigned_at,active').eq('driver_user_id',targetId).eq('active',true).limit(2);
 const rows=read(result,assignmentRows);if(rows.some(row=>row.driver_user_id!==targetId))throw Error('NOT_FOUND');return rows;
}
async function approval(client,targetId,type,vehicleId){
 let query=client.from('verification_requests').select(approvalFields).eq('subject_type','DRIVER').eq('subject_id',targetId).eq('status','APPROVED').eq('verification_type',type);
 if(vehicleId)query=query.eq('related_vehicle_id',vehicleId);
 const row=z.object({verification_type:z.literal(type),reviewed_at:z.string().nullable(),expires_on:z.string().nullable(),related_vehicle_id:nullableId});
 return read(await query.order('reviewed_at',{ascending:false}).order('id',{ascending:false}).limit(1),z.array(row).max(1));
}

/**
 * Server-only exact lookup, including an employee beyond the current list page.
 * The application passes its authenticated actor; no target impersonation occurs.
 * @param {{id:string}} actor
 * @param {string} targetId
 * @param {{client?:ReturnType<typeof createSupabaseAdminClient>}} [ports]
 * @returns {Promise<import('./driver-detail-contract').FleetDriverDetail>}
 */
export async function getSupabaseFleetDriver(actor,targetId,{client=createSupabaseAdminClient()}={}){
 const actorId=id.parse(actor.id),target=id.parse(targetId),owner=await scope(client,actorId);
 if(!await matches(client,target,owner))throw Error('NOT_FOUND');
 const self=target===actorId;
 const [profile,driver,permissions,assigned]=await Promise.all([
  client.from('profiles').select('id,full_name,public_callback_phone,email,active,role,drives_truck').eq('id',target).maybeSingle().then(result=>read(result,profileRow.nullable())),
  self?null:client.from('drivers').select('user_id,name,phone,organization_id,provider_profile_id,active').eq('user_id',target).eq('active',true).maybeSingle().then(result=>read(result,driverRow.nullable())),
  self?null:client.from('driver_permissions').select('can_manage_capacity,can_manage_tracking').eq('user_id',target).maybeSingle().then(result=>read(result,permissionsRow.nullable())),
  assignments(client,target)
 ]);
 if(!profile||profile.id!==target||!profile.active||self&&!profile.drives_truck||!self&&(profile.role!=='DRIVER'||!driver||driver.user_id!==target||!driver.active||!sameScope(driver,owner)))throw Error('NOT_FOUND');
 const assignment=assigned[0]||null;
 let vehicle=null;
 if(assignment){
  let query=client.from('vehicles').select('id,make,model,plate,platform_number,active,organization_id,provider_profile_id').eq('id',assignment.vehicle_id).eq('active',true);
  query=owner.organization_id?query.eq('organization_id',owner.organization_id).is('provider_profile_id',null):query.is('organization_id',null).eq('provider_profile_id',owner.provider_profile_id);
  vehicle=read(await query.maybeSingle(),vehicleRow.nullable());
  if(!vehicle||vehicle.id!==assignment.vehicle_id||!sameScope(vehicle,owner))throw Error('NOT_FOUND');
 }
 const [identity,licence,authorization]=await Promise.all([
  approval(client,target,'IDENTITY'),approval(client,target,'DRIVER_IDENTITY'),
  vehicle?approval(client,target,'VEHICLE_AUTHORIZATION',vehicle.id):Promise.resolve([])
 ]);
 // A later revoke, transfer or reassignment cannot return an earlier private row.
 const [currentOwner,currentMatch,currentAssigned,currentVehicle]=await Promise.all([
  scope(client,actorId),matches(client,target,owner),assignments(client,target),
  vehicle?client.rpc('fleet_actor_can_use_vehicle',{actor_user_id:actorId,target_vehicle_id:vehicle.id,owner_required:true}).then(result=>read(result,z.boolean())):Promise.resolve(true)
 ]);
 if(!sameScope(owner,currentOwner))throw Error('FORBIDDEN');
 if(!currentMatch||!currentVehicle)throw Error('NOT_FOUND');
 if(JSON.stringify(assigned)!==JSON.stringify(currentAssigned))throw Error('FLEET_DRIVER_CONTEXT_CHANGED');
 const name=z.string().trim().min(1).parse(self?profile.full_name:driver.name);
 const label=vehicle?[vehicle.make+' '+vehicle.model,vehicle.platform_number,vehicle.plate].filter(Boolean).join(' · '):null;
 return {id:target,name,phone:self?profile.public_callback_phone:driver.phone,email:profile.email,is_owner:self,
  can_manage_capacity:self||Boolean(permissions?.can_manage_capacity),can_manage_tracking:self||Boolean(permissions?.can_manage_tracking),
  assigned_vehicle_id:vehicle?.id||null,assigned_vehicles:label,
  verification_badges:verificationBadgesFromApproved('DRIVER',[...identity,...licence]),
  truck_verification_badges:vehicle?[truckAuthorizationBadgeFromApproved(authorization,vehicle.id,label)]:[]};
}
