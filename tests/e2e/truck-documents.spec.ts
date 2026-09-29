import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {localAuditService,checked,auditProvider} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';

test('truck document alternatives submit private evidence and show only its reviewed category',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);const service=localAuditService(),actor=await auditProvider(service,'truck-doc');
 let truckId='';const paths:string[]=[];const ids:string[]=[];
 try{
  checked(await service.from('company_pages').insert({provider_profile_id:actor.provider_profile_id,published:false}));
  truckId=checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{make:'Home',model:'Account',plate:`DOC-${actor.suffix}`,cargo_configuration:'Mini Box Truck'}})).id;
  await page.goto('/login');const form=page.getByTestId('email-code-request-form');
  await form.getByLabel('Email',{exact:true}).fill(actor.email);const since=Date.now();await form.getByRole('button',{name:'Email me a code'}).click();
  await expect(page.getByTestId('email-code-form')).toBeVisible();await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(actor.email,since,'Your Loadgistic sign-in code'));
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL(/\/app\/home/);
  await page.goto(`/app/fleet/${truckId}`);await page.getByRole('link',{name:'Submit a truck document'}).click();
  const subject=page.locator('#verification-subject'),type=page.locator('#verification-type');
  await expect(subject).toBeEnabled();await expect(subject).toHaveValue(`VEHICLE:${truckId}`);
  await expect(type.locator('option')).toHaveCount(2);await type.selectOption('VEHICLE_AUTHORIZATION');
  await expect(page.locator('input[name=relatedVehicleId]')).toHaveValue(truckId);await page.getByLabel('Permission expires').fill('2099-01-01');
  await page.getByLabel('Document name',{exact:true}).fill('Home');
  // A user's truck make/model and document title match English UI words deliberately.
  // They must remain unchanged when the interface language switches.
  await page.locator('.language-picker select').selectOption('am');await expect(subject.locator('option:checked')).toContainText('Home Account');
  await expect(page.locator('input[name=documentName]')).toHaveValue('Home');await expect(type).toHaveValue('VEHICLE_AUTHORIZATION');
  await page.locator('.language-picker select').selectOption('en');
  await page.locator('#verification-file').setInputFiles({name:'permission.png',mimeType:'image/png',buffer:readFileSync('public/icon-192.png')});
  await page.screenshot({path:info.outputPath('truck-permission-form.png'),fullPage:true});
  await page.getByRole('button',{name:'Submit for review',exact:true}).click();await expect(page.locator('.alert.success')).toBeVisible();
  const stored=checked(await service.from('verification_requests').select('id,status,storage_path,subject_type,subject_id').eq('submitted_by',actor.id).single());ids.push(stored.id);paths.push(stored.storage_path.replace('supabase://verification/',''));
  expect(stored).toMatchObject({status:'PENDING',subject_type:'VEHICLE',subject_id:truckId});
  await page.goto(`/app/verification?truck=${truckId}`);await expect(type).toBeEnabled();await expect(type.locator('option[value=VEHICLE_AUTHORIZATION]')).toHaveCount(0);await expect(type.locator('option[value=VEHICLE_OWNERSHIP]')).toHaveCount(1);
  const admin=checked(await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
  checked(await service.rpc('review_managed_verification',{actor_user_id:admin.id,request_id:stored.id,review_status:'APPROVED',review_note:'Synthetic local document review'}));
  await page.goto(`/app/fleet/${truckId}`);const badge=page.locator('.verification-badge');await expect(badge).toHaveCount(1);await expect(badge).toContainText('Permission to use truck');await expect(badge).toContainText('Loadgistic reviewed');
  await badge.locator('summary').click();await expect(badge).toContainText('Review applies to this document category only.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('truck-permission-reviewed.png'),fullPage:true});
  await page.goto('/app/company-page');const owner=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Owner documents',exact:true})});
  await expect(owner).toBeVisible();await expect(owner.locator('.verification-badge')).toHaveCount(2);await expect(owner).not.toContainText('Permission to use truck');
  await owner.screenshot({path:info.outputPath('owner-document-scope.png')});
 }finally{
  if(paths.length)checked(await service.storage.from('verification').remove(paths));
  checked(await service.from('verification_requests').delete().eq('submitted_by',actor.id));
  if(ids.length)checked(await service.from('audit_logs').delete().in('entity_id',ids));
  if(truckId){checked(await service.from('audit_logs').delete().eq('entity_id',truckId));checked(await service.from('vehicles').delete().eq('id',truckId));}
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
 }
});

test('public truck separates company, Driver and truck evidence without exposing private files',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(45000);
 const response=await page.request.get('/api/public/capacity');expect(response.ok()).toBe(true);
 const result=await response.json();const truck=result.items.find((item:{provider_organization_id?:string})=>item.provider_organization_id);
 expect(truck).toBeTruthy();expect(truck.owner_verification_badges.length).toBe(3);
 expect(truck.owner_verification_badges.map((badge:{type:string})=>badge.type)).toEqual(['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']);
 expect(JSON.stringify(result)).not.toMatch(/storage_path|original_name|supabase:\/\/verification/);
 await page.goto(`/?truck=${truck.id}`);const sheet=page.locator('.map-capacity-sheet');await expect(sheet).toBeVisible();
 await expect(sheet.getByText('Company documents',{exact:true})).toBeVisible();await expect(sheet.getByText('Driver documents',{exact:true})).toBeVisible();await expect(sheet.getByText('Truck documents',{exact:true})).toBeVisible();
 await sheet.getByText('Company documents',{exact:true}).click();await expect(sheet.locator('.badge-business_license, .badge-business-license')).toContainText('Business License');
 await page.screenshot({path:info.outputPath('public-entity-documents.png'),fullPage:true});
});
