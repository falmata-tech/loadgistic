import {randomUUID} from 'node:crypto';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';
import {checked,localAuditService} from './audit-helpers';
import {expect} from './browser-test';

// This is fixture setup, never an application fallback or a hosted seed path.
const createdOwners=new Map<string,string>();
function local(service:any){
 const endpoint=new URL(service.supabaseUrl);
 if(!['127.0.0.1','localhost'].includes(endpoint.hostname)||endpoint.port!=='55321')throw Error('LOCAL_TRACKING_FIXTURE_REQUIRED');
}
export async function registeredTrackingOwner(service:any,emailValue:string){
 local(service);const email=String(emailValue||'').trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9._+-]{1,120}@(?:example\.test|loadgistic\.local)$/.test(email))throw Error('SYNTHETIC_TRACKING_OWNER_REQUIRED');
 const existing=checked(await service.from('profiles').select('id,role,active').eq('email',email).maybeSingle());
 if(existing){
  const user=checked(await service.auth.admin.getUserById(existing.id)).user;
  if(!['SHIPPER','RECEIVER'].includes(existing.role)||existing.active!==true||!user.email_confirmed_at||user.email?.trim().toLowerCase()!==email)throw Error('REGISTERED_CUSTOMER_FIXTURE_REQUIRED');
  return{id:existing.id,email,created:false};
 }
 const marker='tracking-owner-'+randomUUID(),id=checked(await service.auth.admin.createUser({email,email_confirm:true,
  app_metadata:{fixture_source:'loadgistic',fixture_key:marker,is_demo:true}})).user.id;
 createdOwners.set(email,id);
 // The database retains SHIPPER/RECEIVER; CUSTOMER is a selected business
 // workspace presentation role, never a value in public.user_role.
 checked(await service.from('profiles').update({role:'SHIPPER',active:true,full_name:'Synthetic Tracking owner'}).eq('id',id));
 const saved=checked(await service.from('profiles').select('id,role,active').eq('id',id).single());
 if(saved.role!=='SHIPPER'||saved.active!==true)throw Error('REGISTERED_CUSTOMER_FIXTURE_NOT_SAVED');
 // Existing-content fixtures model a consented account; dedicated consent
 // workflows continue to exercise the actual checkbox separately.
 checked(await service.rpc('accept_content_policy',{actor_user_id:id,policy_version:'2026-10-09'}));
 return{id,email,created:true};
}

export async function createRegisteredTrackingShipment(actor:any,input:any){
 const service=localAuditService();await registeredTrackingOwner(service,input.customerEmail);
 return createProviderShipment(actor,input);
}

export async function issueTrackingFixtureLink(page:any,sessionId:string,allowLocation=false){
 const response=await page.request.post(`/api/tracking/sessions/${sessionId}/links`,{data:{expiresInDays:1,allowLocation}});
 expect(response.status()).toBe(201);const result=await response.json();expect(result.ok).toBe(true);
 const link=result.data.link,url=new URL(link.url);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||!['3100','3101'].includes(url.port)
  ||url.search||url.hash||url.username||url.password||!/^\/track\/[A-Za-z0-9_-]{43}$/.test(url.pathname))throw Error('LOCAL_TRACKING_LINK_REQUIRED');
 expect(link.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
 return link;
}

export async function openTrackingFixtureLink(page:any,link:{url:string;code:string}){
 const url=new URL(link.url);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||!['3100','3101'].includes(url.port))throw Error('LOCAL_TRACKING_LINK_REQUIRED');
 await page.goto(url.pathname,{waitUntil:'domcontentloaded'});
 await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
 await page.getByLabel('Tracking code',{exact:true}).fill(link.code);
 const opened=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/tracking/access'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Open tracking',exact:true}).click();const response=await opened;expect(response.status()).toBe(200);
 const value=await response.json();expect(value.ok).toBe(true);expect(value.data.session.workspaceId).toBeNull();expect(value.data.session.links).toEqual([]);
 expect(Object.values(value.data.session.capabilities).some(Boolean)).toBe(false);
 await expect(page.getByRole('button',{name:'Close Tracking',exact:true})).toBeVisible();
 return value.data.session;
}

export async function cleanupTrackingOwnerFixtures(){
 if(!createdOwners.size)return;
 const service=localAuditService();local(service);
 for(const [email,id]of createdOwners){
  const profile=checked(await service.from('profiles').select('id,role').eq('id',id).maybeSingle());
  if(!profile){createdOwners.delete(email);continue;}
  const user=checked(await service.auth.admin.getUserById(id)).user;
  if(profile.role!=='SHIPPER'||user.email?.trim().toLowerCase()!==email
   ||user.app_metadata?.fixture_source!=='loadgistic'||!String(user.app_metadata.fixture_key||'').startsWith('tracking-owner-'))throw Error('TRACKING_OWNER_CLEANUP_SCOPE_REQUIRED');
  // Existing shipment/proof finally blocks run first. Do not delete an owner
  // while any retained shipment still refers to this fixture's recipient.
  const retained=checked(await service.from('provider_tracking_recipients').select('id').eq('recipient_email',email));
  if(retained.length)throw Error('TRACKING_OWNER_CLEANUP_SHIPMENT_REMAINS');
  checked(await service.from('audit_logs').delete().eq('actor_user_id',id));
  checked(await service.auth.admin.deleteUser(id));createdOwners.delete(email);
 }
}
