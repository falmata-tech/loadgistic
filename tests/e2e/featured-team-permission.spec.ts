import {test,expect as baseExpect} from './browser-test';
const expect=baseExpect.configure({timeout:30000});
import type {Page,Browser,BrowserContext} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {randomUUID,randomInt} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {getDailyFeaturedProviders} from '../../src/lib/public-featured.js';

test('admin grants Featured alone; staff sign in, publish and lose access when revoked @featured-prepare',async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(360000);page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);const service=localAuditService(),suffix=randomUUID().slice(0,8),email=`featured-${suffix}@example.test`;
 const date=new Date(Date.UTC(2095,0,1)+randomInt(0,3650)*86400000).toISOString().slice(0,10);
 let staffId='',staffContext:BrowserContext|undefined,stage='SETUP',flowError:unknown;const sessions:Array<ReturnType<typeof createClient>>=[];
 const admin=checked(await service.from('profiles').select('id').eq('active',true).eq('role','ADMIN').limit(1).single());
 const prior=checked(await service.from('platform_controls').select('access_mode,featured_mode,featured_target_count,updated_by,updated_at').eq('singleton',true).single());
 async function post(p:Page,action:()=>Promise<void>,path:string){const response=p.waitForResponse(r=>r.url().includes(path)&&r.request().method()==='POST',{timeout:90000});await action();expect((await response).status()).toBe(303);}
 async function deleteFixtureAuth(id:string){
  for(let attempt=0;attempt<3;attempt++){
   const result=await service.auth.admin.deleteUser(id);
   if(!result.error||result.error.status===404)return;
   if(result.error.name!=='AuthRetryableFetchError'||attempt===2)checked(result);
   await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
 }
 try{
  stage='CREATE_STAFF';
  const identity=checked(await service.auth.admin.getUserById(admin.id)).user,link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email!})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});sessions.push(client);
  const login=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();
  await page.context().addCookies(createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url')).map(c=>({...c,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
  // The former payment-plan endpoint is retired even for an administrator.
  expect((await page.request.post('/api/admin/settings',{form:{section:'ACCESS',mode:'TRIAL_PAYMENT',confirm:'ENABLE'}})).status()).toBe(410);
  await page.goto('/admin/support?tab=team');const create=page.locator('form[action="/api/admin/support-agents"]');await page.getByRole('button',{name:'Add member',exact:true}).click();
  await expect(create.locator('[name=canManageFeatured]')).not.toBeChecked();await create.locator('[name=name]').fill(`Featured staff ${suffix}`);await create.locator('[name=email]').fill(email);await create.locator('[name=canManageSupport]').uncheck();await create.locator('[name=canManageFeatured]').check();
  await create.getByRole('button',{name:'Create member',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('featured-permission-create.png'),fullPage:true});
  await post(page,()=>create.getByRole('button',{name:'Create member',exact:true}).click(),'/api/admin/support-agents');await expect(page).toHaveURL(/success=/);
  staffId=checked(await service.from('profiles').select('id').eq('email',email).single()).id;
  expect(checked(await service.from('support_agent_profiles').select('can_manage_featured,can_manage_brokerage,can_manage_support,can_manage_billing,can_manage_customers,can_manage_operations,can_manage_trust').eq('user_id',staffId).single())).toEqual({can_manage_featured:true,can_manage_brokerage:false,can_manage_support:false,can_manage_billing:false,can_manage_customers:false,can_manage_operations:false,can_manage_trust:false});
  stage='STAFF_LOGIN';staffContext=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:page.viewportSize()!,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.245'}});const staff=await staffContext.newPage();staff.setDefaultTimeout(20000);staff.setDefaultNavigationTimeout(60000);
  await staff.goto('/login',{waitUntil:'domcontentloaded',timeout:30000});const since=Date.now();await staff.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);await staff.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(staff.getByTestId('email-code-form')).toBeVisible();
  const code=await localMailpitNumericCode(email,since,['Your Loadgistic signup code','Your Loadgistic sign-in code']);await staff.getByLabel('Six-digit code',{exact:true}).fill(code);await staff.getByRole('button',{name:'Continue',exact:true}).click();await expect(staff).toHaveURL(/\/admin\/featured$/,{timeout:30000});
  await expect(staff.locator('.featured-operation-overview')).toBeVisible({timeout:30000});await expect(staff.locator('.sidebar-nav a')).toHaveCount(1);await expect(staff.locator('.sidebar-nav a')).toHaveAttribute('href','/admin/featured');
  expect((await staff.request.post('/api/admin/settings',{form:{section:'ACCESS',mode:'TRIAL_PAYMENT',confirm:'ENABLE'}})).status()).toBe(403);
  expect((await staff.request.post('/api/admin/support-agents',{form:{name:'Unwanted',email:'unwanted@example.test'}})).status()).toBe(403);
  expect((await staff.request.get('/api/brokerage/updates?queue=MINE&view=ALL')).status()).toBe(410);
  stage='SELECTION_SETTINGS';await staff.getByText('Selection settings',{exact:true}).click();await staff.getByLabel('Selection',{exact:true}).selectOption(prior.featured_mode);await staff.getByLabel('Maximum Drivers per day',{exact:true}).fill(String(prior.featured_target_count));
  await post(staff,()=>staff.getByRole('button',{name:'Save selection settings',exact:true}).click(),'/api/admin/settings');await expect(staff.getByText('Daily selection settings saved.',{exact:true})).toBeVisible();
  if(prior.featured_mode==='AUTO'){await post(staff,()=>staff.getByRole('button',{name:'Prepare upcoming days',exact:true}).click({noWaitAfter:true}),'/api/admin/settings');await expect(staff.getByText(/\d+ days prepared\. \d+ kept unchanged\./)).toBeVisible();}
  await staff.screenshot({path:info.outputPath('featured-staff-overview.png'),fullPage:true});
  stage='FEATURED_DAY';await staff.goto(`/admin/featured?date=${date}&edit=day`);const editor=staff.locator('.featured-roster-editor'),select=editor.getByLabel('Add vehicle and Driver');await select.selectOption((await select.locator('option').nth(1).getAttribute('value'))!);await editor.getByRole('button',{name:'Add',exact:true}).click();await editor.getByRole('combobox',{name:'Featured vehicles',exact:true}).selectOption('1');
  await staff.getByLabel('Headline',{exact:true}).fill(`Staff feature ${suffix}`);await staff.getByLabel('Short introduction',{exact:true}).fill('Meet the vehicle and its driver.');await staff.getByLabel('Live link (optional)',{exact:true}).fill('https://www.tiktok.com/@loadgistic/live');
  await post(staff,()=>staff.getByRole('button',{name:'Save draft',exact:true}).click(),'/api/admin/featured');await expect(staff.getByText('Draft saved.',{exact:true})).toBeVisible();expect((await getDailyFeaturedProviders(date)).providers).toHaveLength(0);
  await staff.getByRole('link',{name:'Edit programme',exact:true}).click();await post(staff,()=>staff.getByRole('button',{name:'Publish this day',exact:true}).click(),'/api/admin/featured');await expect(staff.getByText('Daily feature published.',{exact:true})).toBeVisible();let publicFeature=await getDailyFeaturedProviders(date);expect(publicFeature.providers).toHaveLength(1);expect(publicFeature.tiktok_broadcast_status).toBe('SCHEDULED');expect(publicFeature.broadcast_start_time).toBeTruthy();await expect(staff.locator('.featured-broadcast-admin-state')).toContainText('TikTok LIVE broadcast planned');
  stage='TIKTOK_LIVE';await post(staff,()=>staff.getByRole('button',{name:'Mark TikTok LIVE',exact:true}).click(),'/api/admin/featured');await expect(staff.getByText('TikTok Live marked live.',{exact:true})).toBeVisible();publicFeature=await getDailyFeaturedProviders(date);expect(publicFeature.tiktok_broadcast_status).toBe('LIVE');expect(publicFeature.tiktok_url).toContain('tiktok.com');await staff.goto('/featured');await expect(staff.locator('.featured-tiktok-status')).toContainText('TikTok LIVE broadcast is on now');await expect(staff.getByRole('link',{name:'Watch live on TikTok',exact:true})).toBeVisible();
  await staff.goto(`/admin/featured?date=${date}`);await post(staff,()=>staff.getByRole('button',{name:'End TikTok Live',exact:true}).click(),'/api/admin/featured');await expect(staff.getByText('TikTok Live marked ended.',{exact:true})).toBeVisible();expect((await getDailyFeaturedProviders(date)).tiktok_broadcast_status).toBe('ENDED');await staff.goto('/featured');await expect(staff.locator('.featured-tiktok-status')).toContainText('TikTok LIVE broadcast ended today');
  stage='SPONSOR';await staff.getByRole('button',{name:'Schedule sponsor',exact:true}).click();await staff.getByLabel('Sponsor type',{exact:true}).selectOption('ADVERTISER');await staff.getByLabel('Business name',{exact:true}).fill(`Featured sponsor ${suffix}`);await staff.getByLabel('Short description',{exact:true}).fill('Synthetic sponsor for local workflow verification.');await staff.getByLabel('Website (optional)',{exact:true}).fill('https://example.test');
  await post(staff,()=>staff.locator('.featured-sponsor-form button[name=command][value=SAVE_SPONSOR]').click(),'/api/admin/featured');await expect(staff.getByText('Sponsored placement saved.',{exact:true})).toBeVisible();await expect(staff.getByText(`Featured sponsor ${suffix}`,{exact:true})).toBeVisible();
  await post(staff,()=>staff.getByRole('button',{name:'Disable',exact:true}).click(),'/api/admin/featured');await expect(staff.getByText('Sponsored placement disabled.',{exact:true})).toBeVisible();
  expect(checked(await service.from('platform_controls').select('access_mode').eq('singleton',true).single()).access_mode).toBe(prior.access_mode);
  stage='PERMISSION_CHANGE';await page.goto('/admin/support?tab=team');const edit=page.locator(`form[action="/api/admin/support-agents/${staffId}"]`);await page.locator(`[data-member-id="${staffId}"]`).getByRole('button',{name:'Edit member',exact:true}).click();
  await expect(edit.locator('[name=canManageBilling]')).toHaveValue('');
  // Responsibilities combine: Featured never removes separately granted work.
  for(const permission of ['canManageSupport','canManageCustomers','canManageTrust'])await edit.locator(`[name=${permission}]`).check();
  await expect(edit.locator('[name=canManageBrokerage]')).toHaveCount(0);
  await edit.locator('[name=available]').uncheck();
  await post(page,()=>edit.getByRole('button',{name:'Save permissions',exact:true}).click(),'/api/admin/support-agents');await expect(page).toHaveURL(/success=/);
  await staff.goto('/admin/featured');await expect(staff.locator('.featured-operation-overview')).toBeVisible({timeout:30000});
  for(const href of ['/admin/featured','/support','/admin/operations','/admin/reviews'])await expect(staff.locator(`.sidebar-nav a[href="${href}"]`)).toHaveCount(1);
  await expect(staff.locator('.sidebar-nav a[href="/brokerage"]')).toHaveCount(0);
  expect((await staff.request.get('/api/brokerage/updates?queue=MINE&view=ALL')).status()).toBe(410);
  await expect(staff.locator('.workspace-title .meta')).toHaveText('Platform team');
  await staff.screenshot({path:info.outputPath('combined-responsibilities.png'),fullPage:true});
  await page.locator(`[data-member-id="${staffId}"]`).getByRole('button',{name:'Edit member',exact:true}).click();await edit.locator('[name=canManageFeatured]').uncheck();await post(page,()=>edit.getByRole('button',{name:'Save permissions',exact:true}).click(),'/api/admin/support-agents');await expect(page).toHaveURL(/success=/);
  expect((await staff.request.post('/api/admin/settings',{form:{section:'PREPARE_FEATURED'}})).status()).toBe(403);
  expect((await staff.request.post('/api/admin/featured',{form:{featureDate:date,command:'PUBLISH'}})).status()).toBe(403);
  expect((await staff.request.post('/api/admin/featured',{form:{featureDate:date,command:'TIKTOK_LIVE'}})).status()).toBe(403);
  await staff.goto('/admin/featured');await expect(staff.locator('.featured-operation-overview')).toHaveCount(0);
 }catch(error){flowError=error;throw error}finally{try{
  if(staffContext)await staffContext.close();for(const s of sessions)await s.auth.signOut({scope:'local'});
  const days=checked(await service.from('featured_provider_days').select('id').eq('feature_date',date));for(const day of days){checked(await service.from('audit_logs').delete().eq('entity_id',day.id));checked(await service.from('featured_provider_days').delete().eq('id',day.id));}
  const sponsors=checked(await service.from('sponsors').select('id').eq('business_name',`Featured sponsor ${suffix}`));for(const sponsor of sponsors){checked(await service.from('sponsor_placements').delete().eq('sponsor_id',sponsor.id));checked(await service.from('sponsors').delete().eq('id',sponsor.id));}
  const identities=checked(await service.from('profiles').select('id').eq('email',email));for(const identity of identities){checked(await service.from('platform_controls').update({updated_by:prior.updated_by,updated_at:prior.updated_at}).eq('singleton',true).eq('updated_by',identity.id));checked(await service.from('audit_logs').delete().eq('actor_user_id',identity.id));checked(await service.from('audit_logs').delete().eq('entity_id',identity.id));await deleteFixtureAuth(identity.id);}
 }catch(cleanupError){if(flowError)throw new AggregateError([flowError,cleanupError],`Featured workflow and cleanup failed at ${stage}`);throw cleanupError}}
});
