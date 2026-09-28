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
  const plan=checked(await service.from('plans').select('id').eq('audience','DRIVER').eq('active',true).limit(1).single());
  checked(await service.from('subscriptions').insert({provider_profile_id:provider.id,plan_id:plan.id,status:'SPONSORED',billing_model:'SPONSORED_FREE',starts_at:new Date().toISOString()}));
  return {id,email,role:'DRIVER',driver_kind:'SELF_MANAGED',provider_profile_id:provider.id,suffix};
 }catch(error){checked(await service.auth.admin.deleteUser(id));throw error;}
}
