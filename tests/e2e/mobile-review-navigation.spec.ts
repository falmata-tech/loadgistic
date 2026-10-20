import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked,auditProvider,auditAssignAndPublishSelfDrivenVehicle,auditDeleteVehicles} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';

test.use({trace:'off',screenshot:'off'});
test('review login leaves a usable Marketplace and preserves both area destinations',async({page}:{page:Page})=>{
 test.setTimeout(120000);
 const service=localAuditService(),actor=await auditProvider(service,'review-nav');
 const password=randomUUID()+randomUUID();let vehicle='';
 try{
  vehicle=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Demo',model:'Navigation',plate:`RN-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  await auditAssignAndPublishSelfDrivenVehicle(service,actor,vehicle);
  checked(await service.auth.admin.updateUserById(actor.id,{password,app_metadata:{loadgistic_review:true}}));
  checked(await service.from('provider_profiles').update({review_workspace:true}).eq('id',actor.provider_profile_id));
  checked(await service.from('app_review_accounts').insert({user_id:actor.id,provider_profile_id:actor.provider_profile_id,expected_role:'DRIVER',tracking_digest:(randomUUID()+randomUUID()).replaceAll('-',''),capacity_digest:(randomUUID()+randomUUID()).replaceAll('-','')}));
  await page.goto('http://localhost:8084/review-access');
  await page.getByLabel('Review account email',{exact:true}).fill(actor.email);
  await page.getByLabel('Review account password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByText('Find space for your next load',{exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('tab',{name:'My workspace',exact:true}).click();
  await expect(page.getByRole('button',{name:'Capacity',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Marketplace',exact:true}).click();
  await expect(page.getByText('Find space for your next load',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'About',exact:true}).click();
  await expect(page).toHaveURL(/\/about$/);const aboutUrl=page.url();
  await page.getByRole('tab',{name:'My workspace',exact:true}).click();
  await expect(page.getByRole('button',{name:'Capacity',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Marketplace',exact:true}).click();
  await expect(page).toHaveURL(aboutUrl);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:'Send code',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Capacity',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Marketplace',exact:true}).click();
  await page.getByRole('tab',{name:'My workspace',exact:true}).click();
  await expect(page.getByRole('button',{name:'Send code',exact:true})).toBeVisible();
 }finally{
  await page.goto('about:blank');
  checked(await service.from('app_review_accounts').delete().eq('user_id',actor.id));
  if(vehicle){checked(await service.from('audit_logs').delete().eq('entity_id',vehicle));checked(await auditDeleteVehicles(service,'id',vehicle));}
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await service.auth.admin.deleteUser(actor.id));
 }
});
