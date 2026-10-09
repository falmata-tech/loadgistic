import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {chromium} from 'playwright';
import {expect as baseExpect} from '@playwright/test';
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const key=name=>env.match(new RegExp('^'+name+'=(.+)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const db=createClient('http://127.0.0.1:55321',key('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}}),anon=key('NEXT_PUBLIC_SUPABASE_ANON_KEY')||key('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');assert.ok(anon);
const browser=await chromium.launch({headless:true}),expect=baseExpect.configure({timeout:30000}),users=[],organizations=[],clients=[],contexts=[],errors=[];
let stage='setup';
const checked=result=>{assert.equal(result.error,null,'Local fixture operation failed');return result.data;};
const forbidden=/\b(?:NO PLAN|TRIAL|PAYMENT_REQUIRED|PAYMENT_UNDER_REVIEW)\b|Account & plan|Plan and payments|No plan assigned|Submit payment|Paid access|7-day trial|Plan & billing|Your plan has expired|Trial, then payment/;
async function session(email){const link=checked(await db.auth.admin.generateLink({type:'magiclink',email})),client=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);return checked(await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token})).session;}
async function context(){const c=await browser.newContext({viewport:{width:412,height:915},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.250'}});contexts.push(c);return c;}
async function call(path,token,body){const response=await fetch('http://127.0.0.1:3100/api/mobile/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-forwarded-for':'127.0.0.250'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});assert.ok(response.headers.get('content-type')?.includes('application/json'),`Unexpected response from mobile/${path}: ${response.status}`);return {status:response.status,value:await response.json()};}
async function cleanCopy(page){assert.doesNotMatch(await page.locator('body').innerText(),forbidden);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
async function shot(page,name){await cleanCopy(page);await page.screenshot({path:new URL(`.local/no-plans-${name}.png`,root).pathname,fullPage:true});}
try{
 for(const model of process.argv.includes('--admin-only')?[]:['TRANSPORT_COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER']){
  stage=model;
  const email=`no-plans-${randomUUID()}@example.test`,user=checked(await db.auth.admin.createUser({email,email_confirm:true,user_metadata:{full_name:'No-plan test provider'}})).user;users.push(user.id);const login=await session(email);
  assert.equal((await call('onboarding',login.access_token,{name:'No-plan test provider',businessName:'No-plan transport',phone:'+251900000086',applicationType:model})).status,200);
  const projected=checked(await db.from('profiles').select('role,active').eq('id',user.id).single());assert.equal(projected.active,true);
  const membership=checked(await db.from('organization_members').select('organization_id').eq('user_id',user.id));organizations.push(...membership.map(x=>x.organization_id));
  const provider=checked(await db.from('provider_profiles').select('id').eq('user_id',user.id).maybeSingle());
  const subscriptions=await db.from('subscriptions').select('id',{count:'exact',head:true}).or(provider?`provider_profile_id.eq.${provider.id}`:`organization_id.eq.${membership[0].organization_id}`);assert.equal(subscriptions.error,null);assert.equal(subscriptions.count,0);
  const state=await call('session',login.access_token);assert.equal(state.status,200);assert.equal(state.value.access.granted,true);assert.equal(state.value.access.status,'FREE_ACCESS');assert.equal(state.value.access.subscription,null);
  for(const path of ['dashboard','fleet','capacity','verification','support'])assert.equal((await call(path,login.access_token)).status,200,`${model} ${path} must work without a plan`);
  const payment=await call('billing',login.access_token,{amountEtb:100,reference:'Must not charge'});assert.equal(payment.status,410);assert.equal(payment.value.error.code,'BILLING_RETIRED');
  const wc=await context(),webSession=await session(email);await wc.addCookies(createChunks('sb-127-auth-token','base64-'+Buffer.from(JSON.stringify(webSession)).toString('base64url')).map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax'})));const page=await wc.newPage();page.on('pageerror',error=>errors.push(error.name));
  await page.goto('http://127.0.0.1:3100/app/home',{waitUntil:'domcontentloaded',timeout:90000});await expect(model==='TRANSPORT_COMPANY'?page.getByRole('heading',{name:'My Fleet',exact:true}):page.getByRole('heading',{name:'Add your first truck',exact:true})).toBeVisible();await shot(page,`${model.toLowerCase()}-web-home-phone`);
  await page.goto('http://127.0.0.1:3100/app/more',{waitUntil:'domcontentloaded',timeout:90000});await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();await shot(page,`${model.toLowerCase()}-web-account-phone`);await page.setViewportSize({width:1440,height:1000});await shot(page,`${model.toLowerCase()}-web-account-desktop`);
  assert.equal((await page.request.post('http://127.0.0.1:3100/api/billing/payment-proof',{form:{amountEtb:'100'},maxRedirects:0})).status(),410);
  const mc=await context(),mobileSession=await session(email);await mc.addInitScript(token=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},mobileSession.refresh_token);const app=await mc.newPage();app.on('pageerror',error=>errors.push(error.name));
  await app.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});await expect(model==='TRANSPORT_COMPANY'?app.getByRole('button',{name:'Add truck',exact:true}):app.getByText('Add your truck, or ask your fleet owner to assign one, before sharing capacity.',{exact:true})).toBeVisible();await shot(app,`${model.toLowerCase()}-mobile-home`);
  await app.getByRole('tab',{name:'Account',exact:true}).click();await expect(app.getByRole('button',{name:'Account details',exact:true})).toBeVisible();await expect(app.getByRole('textbox',{name:'Your name',exact:true})).toHaveValue('No-plan test provider');await shot(app,`${model.toLowerCase()}-mobile-account`);await app.goto('http://localhost:8084/billing',{waitUntil:'domcontentloaded'});await expect(app).toHaveURL(/\/account-settings$/);await cleanCopy(app);
  console.log('PASS: '+model+' actual signup has no subscription; operating APIs, web/Expo Home and Account work; no plan prompts; stale payment/deep-link retirement');
  await wc.close();await mc.close();
 }
 const owner=checked(await db.from('profiles').select('email').eq('role','ADMIN').eq('active',true).limit(1).single()),ac=await context(),login=await session(owner.email);await ac.addCookies(createChunks('sb-127-auth-token','base64-'+Buffer.from(JSON.stringify(login)).toString('base64url')).map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax'})));const admin=await ac.newPage();
 for(const [path,title] of [['/admin','Platform overview'],['/admin/operations','Platform Records'],['/admin/reviews','Review Center'],['/app/menu','More']]){await admin.goto('http://127.0.0.1:3100'+path,{waitUntil:'domcontentloaded',timeout:90000});await expect(admin.getByRole('heading',{name:title,exact:true})).toBeVisible();await cleanCopy(admin);assert.equal(await admin.getByRole('link',{name:/^(Plans|Payments|Billing|Settings)$/}).count(),0);}
 await admin.goto('http://127.0.0.1:3100/admin/operations?view=WORKSPACES',{waitUntil:'domcontentloaded',timeout:90000});await expect(admin.getByRole('heading',{name:'Platform Records',exact:true})).toBeVisible();await cleanCopy(admin);
 const openClient=admin.locator('a[href^="/admin/operations/workspaces/"]').first();await expect(openClient).toBeVisible();await openClient.click();await expect(admin.getByRole('heading',{name:'Record details',exact:true})).toBeVisible();await cleanCopy(admin);assert.equal(await admin.locator('dt').filter({hasText:/^Plan$/}).count(),0);
 stage='admin retired activation';await shot(admin,'admin-phone');assert.equal((await admin.request.post('http://127.0.0.1:3100/api/admin/settings',{form:{section:'ACCESS',mode:'TRIAL_PAYMENT',confirm:'ENABLE'}})).status(),410);
 stage='admin retired subscription';
 assert.equal((await admin.request.post('http://127.0.0.1:3100/api/admin/records/subscription/'+randomUUID(),{form:{command:'PAID'}})).status(),410);
 await admin.goto('http://127.0.0.1:3100/admin/settings',{waitUntil:'domcontentloaded'});await expect(admin).toHaveURL('http://127.0.0.1:3100/admin');assert.deepEqual(errors,[]);
 console.log('PASS: admin has no plan/payment/activation controls; stale activation and subscription commands cannot charge or grant paid periods');
}catch(error){console.error(`FAIL: ${stage} (${error instanceof Error?error.name:'unknown'})`);process.exitCode=1;}
finally{
 for(const c of contexts)await c.close();for(const client of clients)checked(await client.auth.signOut({scope:'local'}));
 for(const id of users){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.auth.admin.deleteUser(id));}
 for(const id of organizations)checked(await db.from('organizations').delete().eq('id',id));await browser.close();console.log('CLEANUP: exact disposable local signup identities and workspaces only');
}
