import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {localAuditService,checked,auditProvider} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test('Account contains business controls and retains drafts without an extra menu page',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);
 const service=localAuditService(),actor=await auditProvider(service,'grouped-account');
 let signOut:(()=>Promise<unknown>)|undefined;
 try{
  checked(await service.from('company_pages').update({published:false}).eq('provider_profile_id',actor.provider_profile_id).select('id').single());
  signOut=await localSupportLogin(page,actor.id);
  await page.goto('/app/more');
  await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();
  await expectHeaderControlsFit(page);
  const personal=page.getByRole('form',{name:'Account details'});
  await personal.getByLabel('Your name',{exact:true}).fill('Grouped Account Test');
  const [savedResponse]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/account/details')&&response.request().method()==='POST',{timeout:30000}),personal.getByRole('button',{name:'Save account details'}).click()]);
  expect(savedResponse.status()).toBe(200);
  await expect(personal.getByRole('status')).toHaveText('Account details saved.');
  expect(new URL(page.url()).pathname).toBe('/app/more');
  expect(checked(await service.from('profiles').select('full_name').eq('id',actor.id).single()).full_name).toBe('Grouped Account Test');
  const business=page.locator('#business');await business.locator(':scope>summary').click();
  await expect(business.getByRole('link',{name:'Open public page'})).toHaveAttribute('href',/^\/@/);
  await business.getByLabel('Headline',{exact:true}).fill('Draft retained in Account');
  await business.locator(':scope>summary').click();await business.locator(':scope>summary').click();
  await expect(business.getByLabel('Headline',{exact:true})).toHaveValue('Draft retained in Account');
  expect(new URL(page.url()).pathname).toBe('/app/more');
  await business.getByLabel('Region or city administration',{exact:true}).selectOption('ADDIS_ABABA');
  await Promise.all([page.waitForURL(url=>url.pathname==='/app/more'&&url.searchParams.has('success'),{timeout:30000}),business.getByRole('button',{name:'Save transporter information',exact:true}).click()]);
  await expect(page.locator('.alert.success')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/app/more');
  await expect(business.getByLabel('Headline',{exact:true})).toHaveValue('Draft retained in Account');
  const documents=business.locator('#business-documents');await documents.locator(':scope>summary').click();
  await expect(documents.locator('form[action="/api/verifications"]')).toBeVisible();
  await expect(documents.locator('input[name=subjectId]')).toHaveValue(actor.provider_profile_id);
  await expect(documents.locator('input[name=returnTo]')).toHaveValue('/app/more#business');
  await expect(page.locator('.sidebar-nav a[href="/app/menu"],.mobile-nav a[href="/app/menu"]')).toHaveCount(0);
  await expect(page.locator('.mobile-nav a[href="/app/more"]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const duplicateIds=await page.locator('[id]').evaluateAll(elements=>elements.map(el=>el.id).filter((id,index,all)=>all.indexOf(id)!==index));
  expect(duplicateIds).toEqual([]);
  await page.screenshot({path:info.outputPath('account-common-workspace.png'),fullPage:true});
  await business.locator(':scope>summary').click();
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
 const service=localAuditService();
 const member=checked(await service.from('organization_members').select('user_id').eq('membership_role','DRIVER').limit(1).single());
 const signOut=await localSupportLogin(page,member.user_id);
 try{
  await page.goto('/app/more');
  await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();
  await expect(page.getByRole('form',{name:'Account details'})).toBeVisible();
  await expect(page.locator('#business')).toHaveCount(0);
  await expect(page.locator('.mobile-nav a[href="/app/menu"],.mobile-nav a[href="/app/fleet"]')).toHaveCount(0);
  await expect(page.locator('.workspace-support-shortcut')).toBeVisible();
  const documents=page.locator('#documents');await documents.locator(':scope>summary').click();
  await expect(documents.locator('[data-subject-kind=DRIVER]')).toHaveCount(1);
  await expect(documents.locator('[data-subject-kind=ORGANIZATION]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('company-driver-account.png')});
 }finally{await signOut();}
});

async function expectHeaderControlsFit(page:Page){
 const viewport=page.viewportSize();if(!viewport||viewport.width>760)return;
 for(const width of [320,viewport.width]){
  await page.setViewportSize({...viewport,width});
  const header=page.locator('.provider-topbar');
  const box=await header.boundingBox();expect(box).not.toBeNull();
  const boxes=[];
  for(const selector of ['.language-picker select','.workspace-support-shortcut','.mobile-dashboard-exit']){
   const control=header.locator(selector);await expect(control).toBeVisible();
   const rect=await control.boundingBox();expect(rect).not.toBeNull();
   expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);
   expect(rect!.y).toBeGreaterThanOrEqual(box!.y);expect(rect!.y+rect!.height).toBeLessThanOrEqual(box!.y+box!.height+1);
   expect(rect!.height).toBeGreaterThanOrEqual(44);boxes.push(rect!);
  }
  for(let index=1;index<boxes.length;index++)expect(boxes[index].x).toBeGreaterThanOrEqual(boxes[index-1].x+boxes[index-1].width);
 }
}
