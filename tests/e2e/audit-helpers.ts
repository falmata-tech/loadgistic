import {expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function localAuditService(){
 nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
 const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
 return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}
export function checked(result:any){expect(result.error).toBeNull();return result.data;}
export async function auditIdentity(service:any,email:string){
 let identity=checked(await service.from('profiles').select('id,role').eq('email',email).maybeSingle());
 if(!identity){
  const fixture=JSON.parse(readFileSync('resources/fixtures/managed-market.json','utf8'));const users=fixture.tables?.users||fixture.users;
  const original=users?.find((user:{email:string})=>user.email===email);if(!original)throw new Error('LOCAL_FIXTURE_IDENTITY_MISSING');
  identity=checked(await service.from('profiles').select('id,role').eq('full_name',original.name).eq('role',original.role).single());
 }
 return identity;
}
export async function auditLogin(page:any,email:string){
 const identity=await auditIdentity(localAuditService(),email);
 const {localSupportLogin}=await import('./provider-support-helper');
 await localSupportLogin(page,identity.id);await page.goto('/app/home');
 await expect(page).toHaveURL(identity.role==='ADMIN'?/\/admin$/:identity.role==='SUPPORT'?/\/support$/:/\/app\/home(?:\?.*)?$/,{timeout:30000});
 await expect(page.locator('.app-main')).toBeVisible({timeout:30000});
}
export async function auditProvider(service:any,prefix:string){
 const suffix=randomUUID().slice(0,8);const email=`${prefix}-${suffix}@loadgistic.local`;
 const auth=checked(await service.auth.admin.createUser({email,password:'Loadgistic123!',email_confirm:true}));const id=auth.user.id;
 try{
  checked(await service.from('profiles').update({active:true,role:'DRIVER',full_name:`Audit Driver ${suffix}`}).eq('id',id));
  const base=checked(await service.from('provider_profiles').select('city,city_place_ref').not('city_place_ref','is',null).limit(1).single());
  const provider=checked(await service.from('provider_profiles').insert({user_id:id,business_name:`Audit Provider ${suffix}`,handle:`${prefix}-${suffix}`,city:base.city,city_place_ref:base.city_place_ref}).select('id').single());
  // Real managed signup creates the unpublished company page atomically.
  // Keep synthetic providers valid when Account embeds their profile editor.
  checked(await service.from('company_pages').insert({provider_profile_id:provider.id,headline:'Self-managed transport services',about:'Complete this transporter profile before publishing.',published:false}));
  const plan=checked(await service.from('plans').select('id').eq('audience','DRIVER').eq('active',true).limit(1).single());
  checked(await service.from('subscriptions').insert({provider_profile_id:provider.id,plan_id:plan.id,status:'SPONSORED',billing_model:'SPONSORED_FREE',starts_at:new Date().toISOString()}));
  return {id,email,role:'DRIVER',driver_kind:'SELF_MANAGED',provider_profile_id:provider.id,suffix};
 }catch(error){checked(await service.auth.admin.deleteUser(id));throw error;}
}

export async function auditFleetProvider(service:any,prefix:string){
 const suffix=randomUUID().slice(0,8),email=`${prefix}-${suffix}@loadgistic.local`;
 const id=checked(await service.auth.admin.createUser({email,email_confirm:true})).user.id;
 checked(await service.from('profiles').update({role:'TRANSPORTER',active:true,full_name:`Audit fleet ${suffix}`}).eq('id',id));
 const organization=checked(await service.from('organizations').insert({name:`Audit fleet ${suffix}`,handle:`${prefix}-${suffix}`,type:'TRANSPORT_COMPANY'}).select('id').single());
 checked(await service.from('organization_members').insert({organization_id:organization.id,user_id:id,membership_role:'OWNER'}));
 checked(await service.from('company_pages').insert({organization_id:organization.id,published:false}));
 return {id,email,role:'TRANSPORTER',organization_id:organization.id,provider_profile_id:null,suffix};
}

// Disposable fixtures only: production history uses restricted foreign keys.
export async function auditDeleteVehicles(service:any,column:string,value:string|string[]){
 const url=new URL(service.supabaseUrl);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='55321'||!['id','provider_profile_id','organization_id'].includes(column))throw Error('LOCAL_FIXTURE_DELETION_REQUIRED');
 let query=service.from('vehicles').select('id');query=Array.isArray(value)?query.in(column,value):query.eq(column,value);
 const rows=checked(await query),ids=rows.map((row:{id:string})=>row.id);
 if(ids.length)checked(await service.from('vehicle_capacity_sharing').delete().in('vehicle_id',ids));
 let deletion=service.from('vehicles').delete();return await (Array.isArray(value)?deletion.in(column,value):deletion.eq(column,value));
}

export async function auditProof(service:any,shipmentId:string){
 const bytes=readFileSync('public/icon-192.png'),path=`tracking-proof/${shipmentId}/${randomUUID()}.png`;
 checked(await service.storage.from('shipment-proof').upload(path,bytes,{contentType:'image/png'}));
 return {path:`supabase://shipment-proof/${path}`,originalName:'synthetic-proof.png',mimeType:'image/png'};
}

export async function auditTrackingOwnerLogin(page:any,email:string){
 const {localMailpitNumericCode}=await import('./mailpit-helper');
 await page.goto('/track');await page.getByLabel('Email',{exact:true}).fill(email);
 const since=Date.now();await page.getByRole('button',{name:'Email me a code',exact:true}).click();
 await page.getByLabel('6-digit email code').fill(await localMailpitNumericCode(email,since,'Your Loadgistic tracking sign-in code'));
 await page.getByRole('button',{name:'Open tracking',exact:true}).click();
 await expect(page.getByText('Private shipment tracking',{exact:true})).toBeVisible({timeout:30000});
}

export async function auditFleetDriver(service:any,owner:any,vehicleId:string){
 const id=checked(await service.auth.admin.createUser({email:`fleet-audit-${randomUUID()}@example.test`,email_confirm:true})).user.id;
 checked(await service.from('profiles').update({role:'DRIVER',active:true,full_name:'Audit company driver'}).eq('id',id));
 checked(await service.from('organization_members').insert({organization_id:owner.organization_id,user_id:id,membership_role:'DRIVER'}));
 checked(await service.from('drivers').insert({organization_id:owner.organization_id,user_id:id,name:'Audit company driver'}));
 const {updateFleetDriverAccess}=await import('../../src/lib/fleet.js');
 await updateFleetDriverAccess(owner,id,{vehicleId,canManageCapacity:true,canManageTracking:true});
 return {id,role:'DRIVER',driver_kind:'COMPANY',organization_id:owner.organization_id};
}
