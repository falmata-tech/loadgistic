import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {randomUUID,randomInt} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {getDailyFeaturedProviders} from '../../src/lib/public-featured.js';

test('Featured explains automatic operation and persists a manual draft and published day',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);const service=localAuditService(),suffix=randomUUID().slice(0,8);
 const date=new Date(Date.UTC(2085,0,1)+randomInt(0,3650)*86400000).toISOString().slice(0,10);let dayId='',client:ReturnType<typeof createClient>|undefined;
 expect((await service.from('featured_provider_days').select('id',{count:'exact',head:true}).eq('feature_date',date)).count).toBe(0);
 try{
  expect((await page.request.post('/api/admin/settings',{form:{section:'PREPARE_FEATURED'}})).status()).toBe(403);
  const admin=checked(await service.from('profiles').select('id').eq('active',true).eq('role','ADMIN').limit(1).single()),identity=checked(await service.auth.admin.getUserById(admin.id)).user;
  const link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email!})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();
  await page.context().addCookies(createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url')).map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
  await page.goto('/admin/featured');await expect(page.locator('.featured-operation-overview')).toBeVisible();await expect(page.locator('.featured-upcoming-days>a')).toHaveCount(7);
  const controls=checked(await service.from('platform_controls').select('featured_mode').eq('singleton',true).single());
  if(controls.featured_mode==='AUTO'){
   await expect(page.locator('#featured-day-editor')).not.toHaveAttribute('open','');
   const prepared=page.waitForResponse(r=>r.url().includes('/api/admin/settings')&&r.request().method()==='POST');await page.getByRole('button',{name:'Prepare upcoming days',exact:true}).click();expect((await prepared).status()).toBe(303);
   await expect(page.getByRole('heading',{name:'Latest selection check succeeded'})).toBeVisible({timeout:30000});
   const state=checked(await service.from('featured_automation_status').select('outcome,checked_at').eq('singleton',true).single());expect(state.outcome).toBe('READY');expect(state.checked_at).toBeTruthy();
  }
  await page.screenshot({path:info.outputPath('featured-overview.png'),fullPage:true});
  await page.getByText('How automatic selection works',{exact:true}).click();await expect(page.getByText(/A truck type may wait/)).toBeVisible();
  await page.goto(`/admin/featured?date=${date}`);await expect(page.locator('#featured-day-editor')).toHaveAttribute('open','');
  const editor=page.locator('.featured-roster-editor'),select=editor.getByLabel('Add truck and Driver');
  const value=await select.locator('option').nth(1).getAttribute('value');expect(value).toBeTruthy();await select.selectOption(value!);await editor.getByRole('button',{name:'Add',exact:true}).click();
  await editor.getByRole('combobox',{name:'Featured trucks',exact:true}).selectOption('1');await page.getByLabel('Headline',{exact:true}).fill(`Featured review ${suffix}`);await page.getByLabel('Short introduction',{exact:true}).fill('Meet this truck and the driver who operates it.');
  const draft=page.waitForResponse(r=>r.url().includes('/api/admin/featured')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save draft',exact:true}).click();expect((await draft).status()).toBe(303);
  await expect(page.getByText('Draft saved.',{exact:true})).toBeVisible({timeout:30000});let row=checked(await service.from('featured_provider_days').select('id,status,selection_source,target_count').eq('feature_date',date).single());dayId=row.id;expect(row).toMatchObject({status:'DRAFT',selection_source:'MANUAL',target_count:1});
  expect((await getDailyFeaturedProviders(date)).providers).toHaveLength(0);
  const publish=page.waitForResponse(r=>r.url().includes('/api/admin/featured')&&r.request().method()==='POST');await page.getByRole('button',{name:'Publish this day',exact:true}).click();expect((await publish).status()).toBe(303);await expect(page.getByText('Daily feature published.',{exact:true})).toBeVisible({timeout:30000});
  row=checked(await service.from('featured_provider_days').select('id,status,selection_source,target_count').eq('feature_date',date).single());expect(row.status).toBe('PUBLISHED');const publicDay=await getDailyFeaturedProviders(date);expect(publicDay.providers).toHaveLength(1);expect(publicDay.headline).toBe(`Featured review ${suffix}`);
  await editor.getByRole('button',{name:'Manual',exact:true}).click();await expect(editor.getByLabel('Starts',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('featured-manual-day.png'),fullPage:true});
 }finally{
  if(client)await client.auth.signOut({scope:'local'});
  const rows=checked(await service.from('featured_provider_days').select('id').eq('feature_date',date));for(const row of rows){checked(await service.from('audit_logs').delete().eq('entity_id',row.id));checked(await service.from('featured_provider_days').delete().eq('id',row.id));}
 }
});

test('public map and Featured keep useful controls without decorative or false-live labels',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(60000);await page.goto('/');await expect(page.locator('.leaflet-container')).toBeVisible({timeout:30000});await expect(page.getByText('Ethiopia capacity · East Africa view',{exact:true})).toHaveCount(0);
 await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({timeout:30000});
 await page.screenshot({path:info.outputPath('map-copy.png'),fullPage:true});
 await page.goto('/featured');await expect(page.getByRole('heading',{name:'Daily Featured Trucks'}).first()).toBeAttached();
 await expect(page.locator('.featured-rotation-note')).not.toHaveAttribute('open','');await page.getByText('How Featured works',{exact:true}).click();await expect(page.getByText(/A rotating showcase, not a ranking/)).toBeVisible();
 await expect(page.locator('.featured-card-feature').filter({hasText:/^View$|^Live$/})).toHaveCount(0);
 await expect(page.getByText(/roster is being prepared/)).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('featured-public.png'),fullPage:true});
});

test('copy polish keeps admin, member and transporter profile controls usable',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);const service=localAuditService(),sessions:Array<ReturnType<typeof createClient>>=[];
 async function login(role:string){
  const actor=checked(await service.from('profiles').select('id').eq('active',true).eq('role',role).limit(1).single()),identity=checked(await service.auth.admin.getUserById(actor.id)).user;
  const link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email!})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});sessions.push(client);
  const result=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(result.error).toBeNull();await page.context().clearCookies();
  await page.context().addCookies(createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(result.data.session)).toString('base64url')).map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
 }
 try{
  await login('ADMIN');await page.goto('/admin');await expect(page.getByRole('heading',{name:'Platform overview',exact:true})).toBeVisible();await expect(page.getByText('Platform data',{exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('admin-overview.png'),fullPage:true});
  await page.goto('/admin/operations');await expect(page.getByText(/Credentials, sessions, tracking secrets/)).toHaveCount(0);await page.screenshot({path:info.outputPath('admin-records.png'),fullPage:true});
  await page.goto('/admin/capacity-network');await expect(page.getByRole('heading',{name:'Private capacity',exact:true})).toBeVisible();await expect(page.getByText('Assisted matching capacity',{exact:true})).toHaveCount(0);
  await login('TRANSPORTER');await page.goto('/app/home');await expect(page.locator('.action-grid')).toBeVisible();await expect(page.getByText('Operating priorities',{exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('provider-home.png'),fullPage:true});
  await page.goto('/app/network');await expect(page.getByText('Lets our Assisted matching team consider this truck when a visitor asks for help.',{exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('provider-network.png'),fullPage:true});
  const company=checked(await service.from('company_pages').select('organization_id').eq('published',true).not('organization_id','is',null).limit(1).single()),org=checked(await service.from('organizations').select('handle').eq('id',company.organization_id).single());
  await page.goto(`/@${org.handle}`);const toggle=page.locator('.provider-fleet-toggle');if(await toggle.count())await toggle.click();await expect(page.locator('.provider-fleet-showcase')).toBeVisible();await expect(page.getByText('Active fleet',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'View capacity on map',exact:true}).first().click();await expect(page.getByText('Blue outlines show the driver’s approximate location. Confirm availability directly with the transporter.',{exact:true})).toBeVisible();await expect(page.locator('.ethiopia-map-label')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('provider-map.png'),fullPage:true});
 }finally{for(const session of sessions)await session.auth.signOut({scope:'local'});}
});
