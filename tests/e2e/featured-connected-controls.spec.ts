import {test,expect as baseExpect} from './browser-test';
import {randomUUID,randomInt} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {localAuditService,checked} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {getDailyFeaturedProviders} from '../../src/lib/public-featured.js';
const expect=baseExpect.configure({timeout:20000});
test.use({trace:'off',screenshot:'off',video:'off',actionTimeout:15000,navigationTimeout:30000});

test('Featured staff save and publish an isolated manual day and manage its sponsor with current authority',async({page},info)=>{
 test.setTimeout(180000);const db=localAuditService(),ids:string[]=[];
 const date=new Date(Date.UTC(2085,0,1)+randomInt(0,3650)*86400000).toISOString().slice(0,10);
 const marker='Synthetic programme '+randomUUID().slice(0,8);let stage='SETUP',logout:(()=>Promise<unknown>)|undefined,placementId='',sponsorId='';
 const diagnosticFile=info.outputPath('featured-control-diagnostics.json');mkdirSync(path.dirname(diagnosticFile),{recursive:true});
 function phase(value:string){stage=value;writeFileSync(diagnosticFile,JSON.stringify({stage},null,2)+'\n');}
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 const controls=checked(await db.from('platform_controls').select('*').eq('singleton',true).single());
 expect(checked(await db.from('featured_provider_days').select('id').eq('feature_date',date))).toHaveLength(0);
 try{
  const id=checked(await db.auth.admin.createUser({email:`featured-controls-${randomUUID()}@example.test`,email_confirm:true})).user.id;ids.push(id);
  checked(await db.from('profiles').update({role:'SUPPORT',active:true,full_name:'Synthetic Featured staff'}).eq('id',id));
  checked(await db.from('support_agent_profiles').insert({user_id:id,active:true,available:false,can_manage_support:false,can_manage_featured:true}));
  phase('UNAUTHENTICATED_DENIAL');expect((await page.request.post('/api/admin/featured',{form:{featureDate:date,command:'PUBLISH'},maxRedirects:0})).status()).toBe(303);
  phase('STAFF_LOGIN');logout=await localSupportLogin(page,id);phase('EDITOR');await page.goto(`/admin/featured?date=${date}&edit=day`);
  const editor=page.locator('.featured-roster-editor');await expect(editor).toBeVisible();
  const select=editor.getByLabel('Add Transport Provider');await expect(select).toBeEnabled();
  expect(await select.locator('option').count()).toBeGreaterThan(2);
  for(let index=0;index<2;index++){
   const key=await select.locator('option').nth(1).getAttribute('value');expect(key).toBeTruthy();
   await select.selectOption(key!);await editor.getByRole('button',{name:'Add',exact:true}).click();
  }
  await expect(editor.locator('.featured-roster-list>li')).toHaveCount(2);
  await editor.getByRole('combobox',{name:'Featured accounts',exact:true}).selectOption('2');
  await page.getByLabel('Headline',{exact:true}).fill(marker);
  await page.getByLabel('Short introduction',{exact:true}).fill('Meet the Transport Providers in this evening programme.');
  phase('DRAFT');await Promise.all([page.waitForResponse(r=>r.url().includes('/api/admin/featured')&&r.request().method()==='POST'),page.getByRole('button',{name:'Save draft',exact:true}).click()]);
  await expect(page.getByText('Draft saved.',{exact:true})).toBeVisible();
  let day=checked(await db.from('featured_provider_days').select('id,status,selection_source,target_count').eq('feature_date',date).single());
  expect(day).toMatchObject({status:'DRAFT',selection_source:'MANUAL',target_count:2});expect((await getDailyFeaturedProviders(date)).providers).toHaveLength(0);
  phase('MANUAL_TIMES');await page.getByRole('link',{name:'Edit programme',exact:true}).click();await editor.getByRole('button',{name:'Manual',exact:true}).click();
  const rows=editor.locator('.featured-roster-list>li');
  for(const [index,start,end] of [[0,'22:30','23:10'],[1,'23:12','23:57']] as const){
   await rows.nth(index).getByLabel('Starts',{exact:true}).fill(start);await rows.nth(index).getByLabel('Ends',{exact:true}).fill(end);
  }
  phase('PUBLISH');await Promise.all([page.waitForResponse(r=>r.url().includes('/api/admin/featured')&&r.request().method()==='POST'),page.getByRole('button',{name:'Publish this day',exact:true}).click()]);
  await expect(page.getByText('Daily feature published.',{exact:true})).toBeVisible();
  day=checked(await db.from('featured_provider_days').select('id,status,selection_source,target_count').eq('feature_date',date).single());expect(day.status).toBe('PUBLISHED');
  const feature=await getDailyFeaturedProviders(date);expect(feature.providers).toHaveLength(2);expect(feature.headline).toBe(marker);
  await page.getByRole('link',{name:'Edit programme',exact:true}).click();await expect(editor.getByRole('button',{name:'Manual',exact:true})).toHaveClass('active');
  await expect(rows.nth(0).getByLabel('Starts',{exact:true})).toHaveValue('22:30');await expect(rows.nth(1).getByLabel('Ends',{exact:true})).toHaveValue('23:57');
  await editor.screenshot({path:info.outputPath('featured-saved-manual.png')});
  phase('SPONSOR_SAVE');await page.getByRole('link',{name:'Cancel editing',exact:true}).click();await page.getByRole('button',{name:'Schedule sponsor',exact:true}).click();
  const sponsorForm=page.locator('.featured-sponsor-form');await sponsorForm.getByLabel('Sponsor type',{exact:true}).selectOption('ADVERTISER');
  await sponsorForm.getByLabel('Business name',{exact:true}).fill(marker+' sponsor');await sponsorForm.getByLabel('Short description',{exact:true}).fill('Synthetic spare parts supplier for this isolated programme.');
  await sponsorForm.getByLabel('Website (optional)',{exact:true}).fill('https://example.com');
  await Promise.all([page.waitForResponse(r=>r.url().includes('/api/admin/featured')&&r.request().method()==='POST'),sponsorForm.getByRole('button',{name:'Save',exact:true}).click()]);
  await expect(page.getByText('Sponsored placement saved.',{exact:true})).toBeVisible();
  const sponsor=checked(await db.from('sponsors').select('id,business_name').eq('created_by',id).single());sponsorId=sponsor.id;expect(sponsor.business_name).toBe(marker+' sponsor');
  const placement=checked(await db.from('sponsor_placements').select('id,active,starts_on,ends_on').eq('sponsor_id',sponsorId).single());placementId=placement.id;expect(placement).toMatchObject({active:true,starts_on:date,ends_on:date});

  const sponsorCard=page.locator('.featured-sponsor-schedules article').filter({has:page.locator(`input[name="sponsorshipId"][value="${placementId}"]`)});await expect(sponsorCard).toContainText(marker+' sponsor');
  await sponsorCard.screenshot({path:info.outputPath('featured-saved-sponsor.png')});phase('SPONSOR_DISABLE');
  await Promise.all([page.waitForResponse(r=>r.url().includes('/api/admin/featured')&&r.request().method()==='POST'),sponsorCard.getByRole('button',{name:'Disable',exact:true}).click()]);await expect(page.getByText('Sponsored placement disabled.',{exact:true})).toBeVisible();
  expect(checked(await db.from('sponsor_placements').select('active').eq('id',placementId).single()).active).toBe(false);
  phase('REVOKED_AUTHORITY');checked(await db.from('support_agent_profiles').update({can_manage_featured:false}).eq('user_id',id));
  const before=checked(await db.from('featured_provider_days').select('*').eq('id',day.id).single());
  expect((await page.request.post('/api/admin/featured',{form:{featureDate:date,command:'PUBLISH',publicHeadline:'Must not save'},maxRedirects:0})).status()).toBe(403);
  expect(checked(await db.from('featured_provider_days').select('*').eq('id',day.id).single())).toEqual(before);
  expect(checked(await db.from('platform_controls').select('*').eq('singleton',true).single())).toEqual(controls);
  const audits=checked(await db.from('audit_logs').select('action').eq('actor_user_id',id));for(const action of ['FEATURED_DAY_SAVED','FEATURED_DAY_PUBLISHED','SPONSORSHIP_SAVED','SPONSORSHIP_DISABLED'])expect(audits.some((row:any)=>row.action===action)).toBe(true);
  expect(errors).toEqual([]);
 }catch(error){
  const name=error instanceof Error?error.name:'OTHER';const raw=error instanceof Error?error.message:'';
  const failureClass=raw.includes('strict mode violation')?'MULTIPLE_MATCH':raw.includes('toHaveValue')?'VALUE_ASSERTION':raw.includes('toBeVisible')?'VISIBILITY_ASSERTION':(['Error','TimeoutError','AssertionError','TypeError'].includes(name)?name:'OTHER');
  writeFileSync(diagnosticFile,JSON.stringify({stage,failureClass},null,2)+'\n');
  const invalidControls=await page.locator('input:invalid,textarea:invalid,select:invalid').evaluateAll(elements=>elements.map(element=>({name:(element as HTMLInputElement).name,missing:(element as HTMLInputElement).validity.valueMissing}))).catch(()=>[]);
  writeFileSync(diagnosticFile,JSON.stringify({stage,failureClass,invalidControls,editorCount:await page.locator('.featured-roster-editor').count(),rosterRows:await page.locator('.featured-roster-list>li').count()},null,2)+'\n');
  console.log('FEATURED_CONTROLS_STAGE '+stage+' '+failureClass);throw Error('FEATURED_CONTROLS_FAILED '+stage);
 }
 finally{
  if(logout)await logout();
  const days=checked(await db.from('featured_provider_days').select('id').eq('feature_date',date));for(const day of days){checked(await db.from('audit_logs').delete().eq('entity_id',day.id));checked(await db.from('featured_provider_days').delete().eq('id',day.id));}
  for(const id of ids){
   const placements=checked(await db.from('sponsor_placements').select('id').eq('created_by',id));for(const p of placements)checked(await db.from('audit_logs').delete().eq('entity_id',p.id));
   checked(await db.from('sponsor_placements').delete().eq('created_by',id));checked(await db.from('sponsors').delete().eq('created_by',id));checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.auth.admin.deleteUser(id));
  }
  expect(checked(await db.from('featured_provider_days').select('id').eq('feature_date',date))).toHaveLength(0);
 }
});
