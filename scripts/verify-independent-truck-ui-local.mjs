import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {expect as baseExpect} from '@playwright/test';
import {localMailpitNumericCode} from '../tests/e2e/mailpit-helper.ts';
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const key=name=>env.match(new RegExp('^'+name+'=(.+)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const db=createClient('http://127.0.0.1:55321',key('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const browser=await chromium.launch({headless:true}),expect=baseExpect.configure({timeout:45000}),contexts=[],emails=[],clients=[];
let stage='setup';
const checked=result=>{assert.equal(result.error,null,'Local fixture operation failed');return result.data;};
async function context(){const c=await browser.newContext({viewport:{width:412,height:915},permissions:['geolocation'],geolocation:{latitude:41.9,longitude:-87.64,accuracy:10},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.249'}});contexts.push(c);return c;}
async function identity(email){const user=checked(await db.from('profiles').select('id,role,active').eq('email',email).single());assert.equal(user.role,'DRIVER');assert.equal(user.active,true);const provider=checked(await db.from('provider_profiles').select('id').eq('user_id',user.id).single());return {id:user.id,provider:provider.id};}
async function trucks(provider){return checked(await db.from('vehicles').select('id,active,use_basis,make,model,plate').eq('provider_profile_id',provider));}
async function screenshot(page,name){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:new URL(`.local/single-truck-${name}.png`,root).pathname,fullPage:true});}
async function fillWeb(page,basis,model){await page.getByRole('radio',{name:basis==='OWNED'?'I own this truck':"I rent it or have the owner's permission",exact:true}).check();await page.getByLabel('Make',{exact:true}).fill('Toyota');await page.getByLabel('Model',{exact:true}).fill(model);await page.getByLabel('Plate number',{exact:true}).fill('SINGLE-'+model);await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Pickup truck');}
async function mobileDenials(id,email,currentId,previousId){
 const generated=checked(await db.auth.admin.generateLink({type:'magiclink',email}));
 const client=createClient('http://127.0.0.1:55321',key('NEXT_PUBLIC_SUPABASE_ANON_KEY')||key('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);
 const login=checked(await client.auth.verifyOtp({type:'magiclink',token_hash:generated.properties.hashed_token})).session;
 const input={action:'ADD_TRUCK',make:'Toyota',model:'Denied extra',plate:'DENIED-EXTRA',cargoConfiguration:'Pickup truck',useBasis:'OWNED'};
 for(const [body,status,code] of [[input,409,'SINGLE_TRUCK_LIMIT'],[{action:'ADD_DRIVER',name:'Denied driver',email:`denied-${randomUUID()}@example.test`,phone:'+251900000011'},403,'FORBIDDEN'],[{action:'LIFECYCLE',vehicleId:previousId,active:true,reason:'Restore another truck',confirm:true},409,'TRUCK_CHANGE_REQUIRED']]){
  const response=await fetch('http://127.0.0.1:3100/api/mobile/fleet',{method:'POST',headers:{Authorization:'Bearer '+login.access_token,'Content-Type':'application/json','x-forwarded-for':'127.0.0.249'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);
 }
 const state=checked(await db.from('profiles').select('id,role,active').eq('id',id).single());assert.equal(state.active,true);
 assert.equal(checked(await db.from('vehicles').select('id').eq('id',currentId).eq('active',true).single()).id,currentId);
}
try{
 if(!process.argv.includes('--mobile-only')){
  stage='web verified signup';const email=`single-web-${randomUUID()}@example.test`;emails.push(email);const c=await context(),page=await c.newPage();
  await page.goto('http://127.0.0.1:3100/login',{waitUntil:'domcontentloaded',timeout:90000});const requestedAt=Date.now();await page.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(page.getByTestId('email-code-form')).toBeVisible();
  const code=await localMailpitNumericCode(email,requestedAt,['Your Loadgistic signup code','Your Loadgistic sign-in code']);await page.getByLabel('Six-digit code',{exact:true}).fill(code);await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page).toHaveURL(/\/apply(?:\?.*)?$/);
  stage='web signup choices';const setup=page.getByTestId('provider-details-form');await expect(setup.getByRole('radio')).toHaveCount(2);await setup.getByRole('radio',{name:/Independent driver/}).check();await screenshot(page,'web-onboarding-phone');await page.setViewportSize({width:1440,height:1000});await screenshot(page,'web-onboarding-desktop');await page.setViewportSize({width:412,height:915});
  await setup.getByLabel('Your name',{exact:true}).fill('Single web driver');await setup.getByLabel('Transporter name',{exact:true}).fill('Single web transport');await setup.getByLabel('Account phone',{exact:true}).fill('+251900000013');await setup.getByRole('button',{name:'Create transporter workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\/home(?:\?.*)?$/);const who=await identity(email);
  stage='web first truck';await page.goto('http://127.0.0.1:3100/app/fleet',{waitUntil:'domcontentloaded',timeout:90000});await expect(page.getByRole('heading',{name:'Add your truck',exact:true})).toBeVisible();await fillWeb(page,'OWNED','WEB-A');await page.getByRole('button',{name:'Add your truck',exact:true}).click();await expect(page.getByRole('heading',{name:'My truck',exact:true})).toBeVisible();const old=(await trucks(who.provider)).find(row=>row.active);assert.equal(old.use_basis,'OWNED');await screenshot(page,'web-current-phone');await page.setViewportSize({width:1440,height:1000});await screenshot(page,'web-current-desktop');await page.setViewportSize({width:412,height:915});
  assert.equal(await page.getByRole('link',{name:'Add truck',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'Add driver',exact:true}).count(),0);
  stage='web replacement';await page.getByRole('link',{name:'Change truck',exact:true}).click();await expect(page.getByRole('heading',{name:'Change truck',exact:true})).toBeVisible();await fillWeb(page,'PERMISSION','WEB-B');await page.getByRole('checkbox',{name:'Keep my previous truck in history and use this truck instead.',exact:true}).check();await screenshot(page,'web-change-phone');await page.getByRole('button',{name:'Change truck',exact:true}).click();await expect(page.getByRole('heading',{name:'My truck',exact:true})).toBeVisible();const rows=await trucks(who.provider),current=rows.find(row=>row.active);assert.equal(rows.length,2);assert.equal(rows.filter(row=>row.active).length,1);assert.equal(current.use_basis,'PERMISSION');assert.equal(rows.find(row=>row.id===old.id).active,false);
  await page.getByText('Previous trucks',{exact:true}).click();await expect(page.getByText('Toyota WEB-A',{exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Restore truck',exact:true}).count(),0);
  await page.goto('http://127.0.0.1:3100/app/home',{waitUntil:'domcontentloaded',timeout:90000});await expect(page.getByText('Toyota WEB-B',{exact:true}).first()).toBeVisible();assert.equal(await page.locator('#capacity-vehicle').count(),0);await screenshot(page,'web-driver-home');
  await mobileDenials(who.id,email,current.id,old.id);console.log('PASS: web real inbox-code signup offers two models; first truck records ownership; confirmed replacement records permission; one current truck, no fleet/driver/selector/restoration and old history retained');
  await c.close();
 }
 if(!process.argv.includes('--web-only')){
  stage='Expo verified signup';const email=`single-mobile-${randomUUID()}@example.test`;emails.push(email);const c=await context(),page=await c.newPage();const visible=locator=>locator.filter({visible:true});
  await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});await visible(page.getByRole('textbox',{name:'Email',exact:true})).fill(email);const requestedAt=Date.now();await visible(page.getByRole('button',{name:'Send code',exact:true})).click();await expect(visible(page.getByRole('textbox',{name:'Sign-in code',exact:true}))).toBeVisible();
  const code=await localMailpitNumericCode(email,requestedAt,['Your Loadgistic signup code','Your Loadgistic sign-in code']);await visible(page.getByRole('textbox',{name:'Sign-in code',exact:true})).fill(code);await visible(page.getByRole('button',{name:'Sign in',exact:true})).click();await expect(visible(page.getByText('Set up your transporter account',{exact:true}))).toBeVisible();assert.equal(await visible(page.getByRole('button',{name:'Owner-operator',exact:true})).count(),0);
  await visible(page.getByRole('button',{name:'Independent driver',exact:true})).click();await screenshot(page,'mobile-onboarding');await visible(page.getByRole('textbox',{name:'Your name',exact:true})).fill('Single mobile driver');await visible(page.getByRole('textbox',{name:'Transporter name',exact:true})).fill('Single mobile transport');await visible(page.getByRole('textbox',{name:'Phone number',exact:true})).fill('+251900000014');await visible(page.getByRole('button',{name:'Create account',exact:true})).click();
  const addLink=visible(page.getByRole('link',{name:'Add your truck',exact:true}));
  // The dev server may compile a new read route beyond the app's bounded HTTP
  // timeout. Prove its visible read-only recovery once; never resend signup.
  await expect(addLink.or(visible(page.getByText('The request took too long. Please try again.',{exact:true})))).toBeVisible();
  if(!await addLink.isVisible())await visible(page.getByRole('button',{name:'Refresh',exact:true})).click();
  await expect(addLink).toBeVisible();const who=await identity(email);
  stage='Expo first truck';await visible(page.getByRole('link',{name:'Add your truck',exact:true})).click();const addButton=visible(page.getByRole('button',{name:'Add your truck',exact:true}));const fleetReadTimeout=visible(page.getByText('The request took too long. Please try again.',{exact:true}));await expect(addButton.or(fleetReadTimeout)).toBeVisible();if(!await addButton.isVisible())await visible(page.getByRole('button',{name:'Try again',exact:true})).click();await addButton.click();
  async function fillMobile(basis,model){for(const field of ['Make','Model','Plate'])await expect(visible(page.getByRole('textbox',{name:field,exact:true}))).toHaveValue('');await visible(page.getByRole('button',{name:basis==='OWNED'?'I own this truck':"I rent it or have the owner's permission",exact:true})).click();await visible(page.getByRole('textbox',{name:'Make',exact:true})).fill('Toyota');await visible(page.getByRole('textbox',{name:'Model',exact:true})).fill(model);await visible(page.getByRole('textbox',{name:'Plate',exact:true})).fill('SINGLE-'+model);await visible(page.getByRole('button',{name:'Choose truck configuration',exact:true})).click();await visible(page.getByText('Pickup truck',{exact:true})).last().click();await expect(visible(page.getByRole('button',{name:'Close',exact:true}))).toHaveCount(0);}
  await fillMobile('OWNED','MOB-A');await visible(page.getByRole('button',{name:'Add your truck',exact:true})).click();await expect(visible(page.getByText('Toyota MOB-A',{exact:true}))).toBeVisible();const old=(await trucks(who.provider)).find(row=>row.active);assert.equal(old.use_basis,'OWNED');await screenshot(page,'mobile-current');assert.equal(await visible(page.getByRole('button',{name:'Add driver',exact:true})).count(),0);assert.equal(await visible(page.getByRole('button',{name:'Add your truck',exact:true})).count(),0);
  stage='Expo replacement details';await visible(page.getByRole('button',{name:'Change truck',exact:true})).click();await fillMobile('PERMISSION','MOB-B');stage='Expo replacement confirmation';const confirmation=visible(page.getByRole('switch',{name:'Keep my previous truck in history and use this truck instead.',exact:true}));await confirmation.click();await expect(confirmation).toBeChecked();stage='Expo replacement save';await visible(page.getByRole('button',{name:'Change truck',exact:true})).scrollIntoViewIfNeeded();await screenshot(page,'mobile-change');await visible(page.getByRole('button',{name:'Change truck',exact:true})).click();await expect(visible(page.getByText('Toyota MOB-B',{exact:true}))).toBeVisible();const rows=await trucks(who.provider),current=rows.find(row=>row.active);assert.equal(rows.length,2);assert.equal(rows.filter(row=>row.active).length,1);assert.equal(current.use_basis,'PERMISSION');assert.equal(rows.find(row=>row.id===old.id).active,false);await expect(visible(page.getByText('Previous trucks',{exact:true}))).toBeVisible();assert.equal(await visible(page.getByRole('button',{name:'Restore truck',exact:true})).count(),0);
  await visible(page.getByRole('tab',{name:'Home',exact:true})).click();await expect(visible(page.getByText('Toyota MOB-B',{exact:true}))).toBeVisible();assert.equal(await visible(page.getByRole('button',{name:'Trucks and drivers',exact:true})).count(),0);await visible(page.getByRole('button',{name:'Share truck location',exact:true})).click();await expect(visible(page.getByText('No driver location shared yet',{exact:true}))).toHaveCount(0);const position=checked(await db.from('vehicle_driver_locations').select('latitude,longitude,precision_km').eq('vehicle_id',current.id).single());assert.notEqual(position.latitude,41.9);assert.notEqual(position.longitude,-87.64);assert.equal(position.precision_km,20);await expect(visible(page.locator('canvas'))).toBeVisible();await screenshot(page,'mobile-driver-home');await mobileDenials(who.id,email,current.id,old.id);
  console.log('PASS: Expo real inbox-code signup, ownership/permission registration and confirmed replacement persist; map Home shows current truck without a selector; old history stays read-only; direct extra-truck/driver/restore attempts denied');await c.close();
 }
}catch(error){
 console.error(`FAIL: ${stage} (${error instanceof Error?error.name:'unknown'})`);process.exitCode=1;
 for(const c of contexts)for(const page of c.pages()){
  if(page.isClosed())continue;
  const state=await page.evaluate(()=>({path:location.pathname,signupForm:!!document.querySelector('[data-testid="provider-details-form"]'),radioCount:document.querySelectorAll('input[type="radio"]').length,visibleStates:['Set up your transporter account','Set up your transporter workspace','Email me a code','Sign-in code','Choose how you operate.','Could not','Application error','Internal Server Error'].filter(value=>document.body.innerText.includes(value))})).catch(()=>null);
  console.log('STATE: '+JSON.stringify(state));
  await page.screenshot({path:new URL(`.local/single-truck-${process.argv.includes('--mobile-only')?'mobile':'web'}-failure.png`,root).pathname,mask:[page.locator('input[autocomplete="one-time-code"],input[name="code"],input[aria-label="Sign-in code"]')]}).catch(()=>{});
 }
}
finally{
 try{
  for(const c of contexts)await c.close();for(const client of clients)checked(await client.auth.signOut({scope:'local'}));
  for(const email of emails){const user=checked(await db.from('profiles').select('id').eq('email',email).maybeSingle());if(user){
   const provider=checked(await db.from('provider_profiles').select('id').eq('user_id',user.id).maybeSingle());
   if(provider){checked(await db.from('capacities').delete().eq('provider_profile_id',provider.id));checked(await db.from('vehicles').delete().eq('provider_profile_id',provider.id));}
   checked(await db.from('audit_logs').delete().eq('actor_user_id',user.id));checked(await db.auth.admin.deleteUser(user.id));
  }}
  console.log('CLEANUP: exact disposable local signup identities and their own records only');
 }catch(error){console.error('FAIL: exact fixture cleanup ('+(error instanceof Error?error.name:'unknown')+')');process.exitCode=1;}
 finally{await browser.close();}
}
