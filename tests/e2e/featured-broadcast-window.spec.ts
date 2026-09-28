import {test,expect as baseExpect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {randomUUID,randomInt} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {getDailyFeaturedProviders} from '../../src/lib/public-featured.js';
import {getAdminFeaturedProviderDay} from '../../src/lib/platform-admin.js';
const expect=baseExpect.configure({timeout:30000});

test('eight showcases reserve four mentions and manual times persist through publication',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(180000);const service=localAuditService(),suffix=randomUUID().slice(0,8);
 const admin=checked(await service.from('profiles').select('id,role').eq('active',true).eq('role','ADMIN').limit(1).single());
 let date='',client:ReturnType<typeof createClient>|undefined;
 const start=Date.UTC(2110,0,1)+randomInt(0,3650)*86400000;
 for(let offset=0;offset<7;offset++){
  const candidateDate=new Date(start+offset*86400000).toISOString().slice(0,10);
  const candidate=await getAdminFeaturedProviderDay(admin,candidateDate);
  if(!candidate.day&&new Set(candidate.candidates.filter((c:any)=>c.eligible).map((c:any)=>c.driver_user_id)).size>=8){date=candidateDate;break;}
 }
 expect(date).not.toBe('');
 async function save(button:string,message:string){const response=page.waitForResponse(r=>r.url().includes('/api/admin/featured')&&r.request().method()==='POST');await page.getByRole('button',{name:button,exact:true}).click();const result=await response;expect(result.status()).toBe(303);expect(new URL(result.headers().location,'http://127.0.0.1:3100').searchParams.get('error')).toBeNull();await expect(page.getByText(message,{exact:true})).toBeVisible();}
 try{
  const identity=checked(await service.auth.admin.getUserById(admin.id)).user,link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email!})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();
  await page.context().addCookies(createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url')).map(c=>({...c,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
  await page.goto(`/admin/featured?date=${date}`);
  const editor=page.locator('.featured-roster-editor'),select=editor.getByLabel('Add truck and Driver');
  for(let i=0;i<8;i++){await expect(select).toBeEnabled();await select.selectOption((await select.locator('option').nth(1).getAttribute('value'))!);await editor.getByRole('button',{name:'Add',exact:true}).click();}
  await expect(editor.locator('.featured-roster-list>li')).toHaveCount(8);
  await expect(editor.getByRole('button',{name:'Add',exact:true})).toBeDisabled();
  await expect(editor.getByRole('combobox',{name:'Featured trucks',exact:true}).locator('option')).toHaveCount(8);
  await expect(editor.getByRole('combobox',{name:'Sponsor mentions',exact:true})).toHaveValue('4');
  await expect(editor.locator('.featured-schedule-timeline>li')).toHaveCount(12);
  await expect(editor.locator('.featured-schedule-timeline>li').first()).toContainText('08:30–08:56');
  await expect(editor.locator('.featured-schedule-timeline>li').last()).toContainText('11:58–12:00');
  await page.getByLabel('Headline',{exact:true}).fill(`Broadcast review ${suffix}`);
  await page.getByLabel('Short introduction',{exact:true}).fill('Meet the trucks and drivers in today’s programme.');
  await expect(editor.locator('[name=scheduleDayStart]')).toHaveValue('08:30');await expect(editor.locator('[name=scheduleDayEnd]')).toHaveValue('12:00');
  await save('Save draft','Draft saved.');expect((await getDailyFeaturedProviders(date)).providers).toHaveLength(0);
  await page.screenshot({path:info.outputPath('broadcast-automatic.png'),fullPage:true});
  await editor.getByRole('button',{name:'Manual',exact:true}).click();
  await expect(editor.getByLabel('Starts',{exact:true})).toHaveCount(8);
  await expect(editor.getByLabel('Ends',{exact:true}).last()).toHaveValue('11:58');
  await expect(editor.getByRole('combobox',{name:'Sponsor mentions',exact:true})).toBeDisabled();
  const previousFirst=await editor.locator('[name=truckKeys]').first().inputValue();await editor.locator('.featured-roster-list>li').first().getByRole('button',{name:/later$/}).click();
  const firstKey=await editor.locator('[name=truckKeys]').first().inputValue();expect(firstKey).not.toBe(previousFirst);await expect(editor.getByLabel('Starts',{exact:true}).first()).toHaveValue('08:30');
  // Deliberately change the first handover; both adjacent intervals must persist.
  await editor.getByLabel('Ends',{exact:true}).nth(0).fill('08:55');
  await editor.getByLabel('Starts',{exact:true}).nth(1).fill('08:55');
  await save('Publish this day','Daily feature published.');
  const row=checked(await service.from('featured_provider_days').select('id,schedule_mode,schedule_config_json,manual_schedule_json,broadcast_start_time,broadcast_end_time').eq('feature_date',date).single());
  expect(row.schedule_mode).toBe('MANUAL');expect(row.broadcast_start_time).toBe('08:30:00');expect(row.broadcast_end_time).toBe('12:00:00');
  expect(row.manual_schedule_json.find((s:any)=>s.providerKey===firstKey).endTime).toBe('08:55');
  const published=await getDailyFeaturedProviders(date);expect(published.providers).toHaveLength(8);expect(published.schedule.display_label).toBe('08:30–12:00');
  expect(published.schedule.entries.filter((e:any)=>e.type==='PROGRAMME_BREAK')).toHaveLength(4);
  await expect(editor.getByLabel('Ends',{exact:true}).first()).toHaveValue('08:55');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('broadcast-manual.png'),fullPage:true});
  await save('Publish this day','Daily feature published.');await expect(editor.getByLabel('Ends',{exact:true}).first()).toHaveValue('08:55');
  // Schedule one actual sponsor via the staff form; all four slots receive its name.
  await page.getByText('Manage sponsors',{exact:true}).click();await page.getByLabel('Sponsor type',{exact:true}).selectOption('ADVERTISER');
  await page.getByLabel('Business name',{exact:true}).fill(`Broadcast sponsor ${suffix}`);
  await page.getByLabel('Short description',{exact:true}).fill('Synthetic local sponsor for timetable verification.');
  await page.getByLabel('Website (optional)',{exact:true}).fill('https://example.test');
  await save('Schedule sponsor','Sponsored placement saved.');
  const sponsored=await getDailyFeaturedProviders(date);
  expect(sponsored.schedule.entries.filter((e:any)=>e.type==='PROGRAMME_BREAK').every((e:any)=>e.label===`Sponsor · Broadcast sponsor ${suffix}`)).toBe(true);
  await expect(editor.locator('.featured-schedule-timeline>li.programme-break')).toHaveCount(4);
  await expect(editor.locator('.featured-schedule-timeline>li.programme-break').last()).toContainText(`Broadcast sponsor ${suffix}`);
  await editor.locator('.featured-broadcast-editor').screenshot({path:info.outputPath('broadcast-sponsored-timetable.png')});
 }finally{
  if(client)await client.auth.signOut({scope:'local'});
  if(date){const rows=checked(await service.from('featured_provider_days').select('id').eq('feature_date',date));for(const row of rows){checked(await service.from('audit_logs').delete().eq('entity_id',row.id));checked(await service.from('featured_provider_days').delete().eq('id',row.id));}}
  const sponsors=checked(await service.from('sponsors').select('id').eq('business_name',`Broadcast sponsor ${suffix}`));for(const sponsor of sponsors){const placements=checked(await service.from('sponsor_placements').select('id').eq('sponsor_id',sponsor.id));for(const p of placements)checked(await service.from('audit_logs').delete().eq('entity_id',p.id));checked(await service.from('sponsor_placements').delete().eq('sponsor_id',sponsor.id));checked(await service.from('sponsors').delete().eq('id',sponsor.id));}
 }
});

test('public programme keeps its saved hours and opens on desktop and phone',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(60000);localAuditService();const current=await getDailyFeaturedProviders();
 expect(current.providers.length).toBeGreaterThan(0);const errors:string[]=[];page.on('pageerror',()=>errors.push('pageerror'));
 await page.goto('/featured');const panel=page.locator('.expo-schedule-panel');await expect(panel).toBeVisible();
 await panel.locator('summary').click();await expect(panel.locator('.expo-programme-detail>small')).toHaveText(`${current.schedule.display_label} EAT`);
 await expect(panel.locator('.expo-programme-strip>span')).toHaveCount(current.schedule.entries.length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await panel.screenshot({path:info.outputPath('public-saved-timetable.png')});
});
