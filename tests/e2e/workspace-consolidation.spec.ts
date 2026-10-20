import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {localAuditService,checked,auditProvider,auditFleetProvider,acceptAuditContentPolicy} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {randomUUID} from 'node:crypto';
import {inferProviderRegion} from '../../src/lib/provider-regions.js';

test('Independent Account groups saved details, profile edits and documents without an extra menu page',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);
 const service=localAuditService(),actor=await auditProvider(service,'grouped-account');
 let signOut:(()=>Promise<unknown>)|undefined;
 try{
  checked(await service.from('company_pages').update({published:false}).eq('provider_profile_id',actor.provider_profile_id).select('id').single());
  signOut=await localSupportLogin(page,actor.id);
  await page.goto('/app/more');
  await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();
  await expectHeaderControlsFit(page);
  await expect(page.getByRole('form',{name:'Account details'})).toHaveCount(0);
  await page.getByRole('button',{name:'Edit details',exact:true}).click();
  const details=page.getByRole('dialog',{name:'Account details',exact:true});
  const personal=details.getByRole('form',{name:'Account details'});
  await personal.getByLabel('First name',{exact:true}).fill('Grouped Account');
  await personal.getByLabel('Last / father name',{exact:true}).fill('Test');
  const [savedResponse]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/account/details')&&response.request().method()==='POST',{timeout:30000}),personal.getByRole('button',{name:'Save account details'}).click()]);
  expect(savedResponse.status()).toBe(200);
  await expect(personal.getByRole('status')).toHaveText('Account details saved.');
  expect(new URL(page.url()).pathname).toBe('/app/more');
  expect(checked(await service.from('profiles').select('full_name').eq('id',actor.id).single()).full_name).toBe('Grouped Account Test');
  await details.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Grouped Account Test',exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Account sections'}).getByRole('link',{name:'Transporter profile',exact:true}).click();
  const business=page.locator('#business');await expect(business).toBeVisible();
  await expect(business.getByRole('link',{name:'Open public page'})).toHaveAttribute('href',/^\/@/);
  await expect(business.getByLabel('Headline',{exact:true})).toHaveCount(0);
  const legacyHeadline=checked(await service.from('company_pages').select('headline').eq('provider_profile_id',actor.provider_profile_id).single()).headline;
  await business.getByRole('button',{name:'Edit profile',exact:true}).click();
  let editor=page.getByRole('dialog',{name:'Transporter profile',exact:true});
  const originalRegion=await editor.getByLabel('Region or city administration',{exact:true}).inputValue();
  const place=checked(await service.from('provider_profiles').select('city,city_place_ref').eq('id',actor.provider_profile_id).single());
  const selectedRegion=inferProviderRegion(place.city_place_ref,place.city)||'ADDIS_ABABA';
  const draftRegion=selectedRegion==='OROMIA'?'ADDIS_ABABA':'OROMIA';
  await editor.getByLabel('Region or city administration',{exact:true}).selectOption(draftRegion);
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(editor).toHaveCount(0);
  await business.getByRole('button',{name:'Edit profile',exact:true}).click();
  editor=page.getByRole('dialog',{name:'Transporter profile',exact:true});
  await expect(editor.getByLabel('Region or city administration',{exact:true})).toHaveValue(originalRegion);
  await editor.getByLabel('Region or city administration',{exact:true}).selectOption(selectedRegion);
  expect(new URL(page.url()).pathname).toBe('/app/more');
  await Promise.all([page.waitForURL(url=>url.pathname==='/app/more'&&url.searchParams.get('tab')==='profile'&&url.searchParams.has('success'),{timeout:30000}),editor.getByRole('button',{name:'Save transporter information',exact:true}).click()]);
  await expect(page.locator('.alert.success')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/app/more');
  await business.getByRole('button',{name:'Edit profile',exact:true}).click();
  editor=page.getByRole('dialog',{name:'Transporter profile',exact:true});
  await expect(editor.getByLabel('Region or city administration',{exact:true})).toHaveValue(selectedRegion);
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(checked(await service.from('company_pages').select('headline,base_region_code').eq('provider_profile_id',actor.provider_profile_id).single())).toEqual({headline:legacyHeadline,base_region_code:selectedRegion});
  await page.getByRole('navigation',{name:'Account sections'}).getByRole('link',{name:'Documents',exact:true}).click();
  const documents=page.locator('#documents');
  const ownerDocuments=documents.locator('[data-subject-kind=PROVIDER_PROFILE]');await expect(ownerDocuments).toHaveCount(1);
  await ownerDocuments.getByRole('button',{name:'Submit verification',exact:true}).click();
  const verification=page.getByRole('dialog',{name:'Submit verification',exact:true});
  await expect(verification.locator('form[action="/api/verifications"]')).toBeVisible();
  await expect(verification.locator('input[name=subjectId]')).toHaveValue(actor.provider_profile_id);
  await expect(verification.locator('input[name=returnTo]')).toHaveValue('/app/more?tab=documents#documents');
  await verification.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('.sidebar-nav a[href="/app/menu"],.mobile-nav a[href="/app/menu"]')).toHaveCount(0);
  await expect(page.locator('.mobile-nav a[href="/app/more"]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const duplicateIds=await page.locator('[id]').evaluateAll(elements=>elements.map(el=>el.id).filter((id,index,all)=>all.indexOf(id)!==index));
  expect(duplicateIds).toEqual([]);
  await page.screenshot({path:info.outputPath('account-common-workspace.png'),fullPage:true});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:info.outputPath('account-overview.png')});
  await page.goto('/app/menu');await expect(page).toHaveURL(/\/app\/more$/,{timeout:30_000});
 }finally{
  await signOut?.();
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await service.auth.admin.deleteUser(actor.id));
 }
});

test('Company driver Account keeps personal documents without an owner editor or More menu',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);
 const service=localAuditService(),owner=await auditFleetProvider(service,'grouped-driver');
 let memberId='',signOut:(()=>Promise<unknown>)|undefined;
 try{
  memberId=checked(await service.auth.admin.createUser({email:`grouped-driver-${randomUUID()}@loadgistic.local`,email_confirm:true})).user.id;
  checked(await service.from('profiles').update({role:'DRIVER',active:true,full_name:'Synthetic company driver'}).eq('id',memberId));
  checked(await service.from('organization_members').insert({user_id:memberId,organization_id:owner.organization_id,membership_role:'DRIVER'}));
  checked(await service.from('drivers').insert({user_id:memberId,organization_id:owner.organization_id,name:'Synthetic company driver'}));
  await acceptAuditContentPolicy(service,memberId);
  signOut=await localSupportLogin(page,memberId);
  await page.goto('/app/more');
  await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit details',exact:true})).toBeVisible();
  await expect(page.getByRole('form',{name:'Account details'})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Account sections'}).getByRole('link',{name:'Transporter profile',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toHaveCount(0);
  await expect(page.locator('#business')).toHaveCount(0);
  await expect(page.locator('.mobile-nav a[href="/app/menu"],.mobile-nav a[href="/app/fleet"]')).toHaveCount(0);
  await expect(page.locator('.workspace-support-shortcut')).toBeVisible();
  await page.getByRole('navigation',{name:'Account sections'}).getByRole('link',{name:'Documents',exact:true}).click();
  const documents=page.locator('#documents');
  await expect(documents.locator('[data-subject-kind=DRIVER]')).toHaveCount(1);
  await expect(documents.locator('[data-subject-kind=ORGANIZATION]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('company-driver-account.png')});
 }finally{
  await signOut?.();
  if(memberId){checked(await service.from('drivers').delete().eq('user_id',memberId));checked(await service.from('audit_logs').delete().eq('actor_user_id',memberId));checked(await service.auth.admin.deleteUser(memberId));}
  checked(await service.from('audit_logs').delete().eq('actor_user_id',owner.id));
  checked(await service.auth.admin.deleteUser(owner.id));
  checked(await service.from('organizations').delete().eq('id',owner.organization_id));
 }
});

async function expectHeaderControlsFit(page:Page){
 const viewport=page.viewportSize();if(!viewport||viewport.width>760)return;
 for(const width of [320,viewport.width]){
  await page.setViewportSize({...viewport,width});
  const header=page.locator('.provider-topbar');
  const box=await header.boundingBox();expect(box).not.toBeNull();
  const boxes=[];
  for(const selector of ['.language-picker select','.workspace-support-shortcut']){
   const control=header.locator(selector);await expect(control).toBeVisible();
   const rect=await control.boundingBox();expect(rect).not.toBeNull();
   expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);
   expect(rect!.y).toBeGreaterThanOrEqual(box!.y);expect(rect!.y+rect!.height).toBeLessThanOrEqual(box!.y+box!.height+1);
   expect(rect!.height).toBeGreaterThanOrEqual(44);boxes.push(rect!);
  }
  const area=page.getByRole('navigation',{name:'Switch view'});await expect(area.getByRole('link',{name:'Marketplace',exact:true})).toBeVisible();
  expect((await area.boundingBox())!.width).toBeLessThanOrEqual(width);
  for(let index=1;index<boxes.length;index++)expect(boxes[index].x).toBeGreaterThanOrEqual(boxes[index-1].x+boxes[index-1].width);
 }
}


test('Marketplace return keeps the selected location-source filters after visiting My workspace',async({page}:{page:Page})=>{
 test.setTimeout(90000);
 const service=localAuditService(),actor=await auditProvider(service,'area-source-return');
 let signOut:(()=>Promise<unknown>)|undefined;
 try{
  signOut=await localSupportLogin(page,actor.id);
  await page.goto('/?status=EMPTY%2CPARTIAL&locationSource=GPS%2CMOBILE');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  const switcher=page.getByRole('navigation',{name:'Switch view',exact:true});
  await expect(page.getByRole('combobox',{name:'Language',exact:true})).toBeEnabled();
  await Promise.all([page.waitForURL(/\/app\//,{timeout:30000}),switcher.getByRole('link',{name:'My workspace',exact:true}).click()]);
  const back=page.getByRole('navigation',{name:'Switch view',exact:true}).getByRole('link',{name:'Marketplace',exact:true});
  await expect(back).toHaveAttribute('href',/locationSource=GPS%2CMOBILE/);
  await back.click();
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  const url=new URL(page.url());
  expect(url.pathname).toBe('/');
  expect(url.searchParams.get('locationSource')).toBe('GPS,MOBILE');
  expect(url.searchParams.get('status')).toBe('EMPTY,PARTIAL');
 }finally{
  await signOut?.();
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await service.auth.admin.deleteUser(actor.id));
 }
});
