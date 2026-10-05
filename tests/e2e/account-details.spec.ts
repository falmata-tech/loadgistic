import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

function localService(){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}
async function login(page:any,email:string){
  await page.context().clearCookies();await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill(email);await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/home(?:\?.*)?$/);
  await expect(page.locator('.app-main')).toBeVisible();
}
async function post(page:any,input:unknown){
  return page.evaluate(async(body:unknown)=>{
    const response=await fetch('/api/account/details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  },input);
}

test('providers and Company drivers save private account phones even with limited access',async({page}:{page:any},info:any)=>{
  test.setTimeout(180000);const service=localService();const suffix=randomUUID().slice(0,8);
  const identities:{id:string;email:string;kind:string}[]=[];let orgId='';
  const snapshots=path.resolve('artifacts/account-details-2026-09-14');mkdirSync(snapshots,{recursive:true});
  try{
    for(const kind of ['owner','company','independent']){
      const email=`account-${kind}-${suffix}@loadgistic.local`;
      const created=await service.auth.admin.createUser({email,password:'Loadgistic123!',email_confirm:true});
      expect(created.error).toBeNull();const id=created.data.user!.id;identities.push({id,email,kind});
      expect((await service.from('profiles').update({role:kind==='owner'?'TRANSPORTER':'DRIVER',active:true,full_name:`Account ${kind}`,phone:'+251900000010'}).eq('id',id)).error).toBeNull();
    }
    const [owner,company,independent]=identities;
    const org=await service.from('organizations').insert({name:`Account Fleet ${suffix}`,handle:`account-${suffix}`,type:'TRANSPORT_COMPANY'}).select('id').single();
    expect(org.error).toBeNull();orgId=org.data!.id;
    expect((await service.from('organization_members').insert([{user_id:owner.id,organization_id:orgId,membership_role:'OWNER'},{user_id:company.id,organization_id:orgId,membership_role:'DRIVER'}])).error).toBeNull();
    expect((await service.from('drivers').insert({user_id:company.id,organization_id:orgId,name:'Account company',phone:'+251911111111'})).error).toBeNull();
    const provider=await service.from('provider_profiles').insert({user_id:independent.id,business_name:'Account Independent',handle:`account-independent-${suffix}`}).select('id').single();
    expect(provider.error).toBeNull();
    expect((await service.from('company_pages').insert([{organization_id:orgId,contact_phone:'+251922222222'},
      {provider_profile_id:provider.data!.id,contact_phone:'+251933333333'}])).error).toBeNull();
    const publicBefore=await service.from('company_pages').select('*').or(`organization_id.eq.${orgId},provider_profile_id.eq.${provider.data!.id}`).order('id');
    expect(publicBefore.error).toBeNull();
    for(const identity of identities){
      await login(page,identity.email);await page.goto('/app/more');
      const form=page.getByRole('form',{name:'Account details'});
      await expect(form).toBeVisible();await expect(page.getByText('No plan assigned',{exact:true})).toBeVisible();
      await form.getByLabel('Your name',{exact:true}).fill(`Edited ${identity.kind}`);
      await form.getByLabel('Account phone').fill('+251900123456');
      await form.getByRole('button',{name:'Save account details'}).click();
      await expect(form.getByRole('status')).toHaveText('Account details saved.');
      const saved=await service.from('profiles').select('full_name,phone,role,email,active').eq('id',identity.id).single();
      expect(saved.error).toBeNull();expect(saved.data).toEqual({full_name:`Edited ${identity.kind}`,phone:'+251900123456',role:identity.kind==='owner'?'TRANSPORTER':'DRIVER',email:identity.email,active:true});
      await page.reload();await expect(form.getByLabel('Your name',{exact:true})).toHaveValue(`Edited ${identity.kind}`);
      await expect(form.getByLabel('Account phone')).toHaveValue('+251900123456');
      await expect(form.getByRole('button',{name:'Save account details'})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(identity.kind!=='owner')await page.screenshot({path:path.join(snapshots,`${info.project.name}-${identity.kind}.png`),fullPage:true,scale:'css'});
      // Server validation leaves the entered draft intact; no reload or redirect.
      await form.getByLabel('Account phone').fill('-------');
      await form.getByRole('button',{name:'Save account details'}).click();
      await expect(form.getByRole('alert')).toContainText('valid phone');await expect(form.getByLabel('Account phone')).toHaveValue('-------');
      expect((await service.from('profiles').select('phone').eq('id',identity.id).single()).data?.phone).toBe('+251900123456');
      const forged=await post(page,{name:'Forged',phone:'',actor_user_id:owner.id,role:'ADMIN',email:'tampered@example.test'});
      expect(forged.status).toBe(400);
      await form.getByLabel('Account phone').fill('');await form.getByRole('button',{name:'Save account details'}).click();
      await expect(form.getByRole('status')).toHaveText('Account details saved.');
      await page.reload();await expect(form.getByLabel('Account phone')).toHaveValue('');
      expect((await service.from('profiles').select('phone').eq('id',identity.id).single()).data?.phone).toBeNull();
    }
    const callback=await service.from('drivers').select('name,phone').eq('user_id',company.id).single();
    expect(callback.error).toBeNull();expect(callback.data).toEqual({name:'Edited company',phone:'+251911111111'});
    const publicAfter=await service.from('company_pages').select('*').or(`organization_id.eq.${orgId},provider_profile_id.eq.${provider.data!.id}`).order('id');
    expect(publicAfter.error).toBeNull();expect(publicAfter.data).toEqual(publicBefore.data);
    // Exercise this form's native POST fallback after the streamed shell renders.
    // A cloned form has no React submit handler; the visible button posts HTML.
    await page.getByRole('form',{name:'Account details'}).evaluate((form:HTMLFormElement)=>form.replaceWith(form.cloneNode(true)));
    const nativeForm=page.getByRole('form',{name:'Account details'});
    await nativeForm.getByLabel('Account phone').fill('+251900654321');
    const nativePost=page.waitForResponse((response:any)=>response.url().includes('/api/account/details')&&response.request().method()==='POST');
    await nativeForm.getByRole('button',{name:'Save account details'}).click();
    expect((await nativePost).status()).toBe(303);
    await expect(page.getByRole('status').filter({hasText:'Account details saved.'})).toBeVisible();
    await expect(nativeForm.getByLabel('Account phone')).toHaveValue('+251900654321');
    expect(new URL(page.url()).searchParams.has('phone')).toBe(false);
    // Same browser's session is revalidated against current persisted activation.
    expect((await service.from('profiles').update({active:false}).eq('id',independent.id)).error).toBeNull();
    expect((await post(page,{name:'Inactive edit',phone:''})).status).toBe(401);
    await page.context().clearCookies();await page.goto('/about');
    expect((await post(page,{name:'Anonymous edit',phone:''})).status).toBe(401);
    const crossOrigin=await page.request.post('/api/account/details',{headers:{origin:'https://example.invalid'},data:{name:'Forged',phone:''}});
    expect(crossOrigin.status()).toBe(403);
  }finally{
    const ids=identities.map(identity=>identity.id);
    if(ids.length)expect((await service.from('audit_logs').delete().in('actor_user_id',ids)).error).toBeNull();
    if(orgId)expect((await service.from('organizations').delete().eq('id',orgId)).error).toBeNull();
    for(const id of ids)expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
