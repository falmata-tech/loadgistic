import {expect,test} from './browser-test';
import {auditDeleteVehicles,auditFleetDriver,auditFleetProvider,auditLogin,checked,localAuditService} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';

async function withFleetDriver(run:(owner:{email:string},vehicleId:string,driverId:string)=>Promise<void>){
  const db=localAuditService(),owner=await auditFleetProvider(db,'driver-document');
  let vehicleId='',driver:Awaited<ReturnType<typeof auditFleetDriver>>|null=null;
  try{
    vehicleId=(await createProviderVehicle(owner,{useBasis:'OWNED',make:'Isuzu',model:'Document review',plate:`DOC-${owner.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
    driver=await auditFleetDriver(db,owner,vehicleId);
    await run(owner,vehicleId,driver.id);
  }finally{
    if(vehicleId){checked(await db.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await db.from('driver_vehicle_assignments').delete().eq('vehicle_id',vehicleId));}
    if(driver){checked(await db.from('drivers').delete().eq('user_id',driver.id));checked(await db.from('organization_members').delete().eq('user_id',driver.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',driver.id));checked(await db.auth.admin.deleteUser(driver.id));}
    checked(await auditDeleteVehicles(db,'organization_id',owner.organization_id));checked(await db.from('company_pages').delete().eq('organization_id',owner.organization_id));checked(await db.from('organization_members').delete().eq('user_id',owner.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await db.from('audit_logs').delete().eq('organization_id',owner.organization_id));checked(await db.from('organizations').delete().eq('id',owner.organization_id));checked(await db.auth.admin.deleteUser(owner.id));
  }
}

test('truck management names its Driver and verification stays optional',async({page}:{page:any},testInfo:any)=>{
  test.setTimeout(90_000);
  await withFleetDriver(async(owner,vehicleId,driverId)=>{
  await auditLogin(page,owner.email,'/app/home/vehicles?view=drivers');
  const row=page.locator('#driver-access article').filter({has:page.locator(`a[href*="driver=${driverId}"]`)});
  await expect(row.getByRole('link',{name:'Manage',exact:true})).toBeVisible();
  await row.getByRole('link',{name:'Manage',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/home\/vehicles\?view=drivers&driver=[a-f0-9-]+/,{timeout:20000});
  const expectedDriver=await page.locator('#driver-access h2').innerText();
  await page.locator('#driver-access').getByRole('link',{name:'View vehicle',exact:true}).click();
  await page.getByRole('navigation',{name:'Vehicle'}).getByRole('link',{name:'Vehicle details'}).click();
  await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText(expectedDriver);
  await expect(page.getByRole('link',{name:'Manage driver'})).toHaveAttribute('href',`/app/home/vehicles?view=drivers&vehicle=${vehicleId}&driver=${driverId}`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('truck-driver-link.png')});
  await page.goto('/app/verification',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Build confidence in your transport service with optional document review.')).toBeVisible();
  await expect(page.locator('.verification-subject-list')).toBeVisible();
  });
});

test('selected public truck separates Driver and truck review categories',async({page,request}:{page:any;request:any},testInfo:any)=>{
  const response=await request.get('/api/public/capacity');
  expect(response.ok()).toBe(true);
  const truck=(await response.json()).items[0];
  expect(truck.assigned_driver_first_name).toBeTruthy();
  await page.goto(`/?truck=${encodeURIComponent(truck.id)}`);
  await page.locator('.map-info-bubble.truck').click();
  const sheet=page.locator('.map-capacity-sheet');
  await expect(sheet.locator('.truck-inspection-person.driver')).toContainText(truck.assigned_driver_first_name);
  for(const [label,key] of [['Driver documents','driver_verification_badges'],['Vehicle documents','truck_verification_badges']]){
    const badges=truck[key]||[];
    const reviewed=badges.filter((badge:any)=>badge.verified&&!badge.expired).length;
    const details=sheet.locator('.truck-document-summary').filter({hasText:label});
    await expect(details.locator('summary').first()).toContainText(`${reviewed} of ${badges.length} reviewed`);
    await details.locator('summary').first().click();
    await expect(details.locator('.verification-badge')).toHaveCount(badges.length);
    await expect(details.locator('a[href*="/api/files"]')).toHaveCount(0);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('truck-review-categories.png')});
});

test('Fleet keeps add, contact and remove actions distinct and responsive',async({page}:{page:any},info:any)=>{
  await withFleetDriver(async(owner,_vehicleId,driverId)=>{
  await auditLogin(page,owner.email,'/app/home/vehicles?view=drivers');
  await expect(page.getByRole('link',{name:'Add driver',exact:true}).first()).toBeVisible();
  await page.locator('#driver-access article').filter({has:page.locator(`a[href*="driver=${driverId}"]`)}).getByRole('link',{name:'Manage',exact:true}).click();const driver=page.locator('#driver-access');
  await driver.getByRole('button',{name:'Edit assignment',exact:true}).click();const assignment=page.getByRole('dialog',{name:'Assigned vehicle',exact:true});
  const checkbox=await assignment.getByLabel('Capacity updates',{exact:true}).boundingBox();
  expect(checkbox!.width).toBeLessThanOrEqual(24);
  await assignment.getByRole('button',{name:'Cancel',exact:true}).click();await driver.getByRole('link',{name:'Contact',exact:true}).click();await driver.getByRole('button',{name:'Edit contact',exact:true}).click();const contact=page.getByRole('dialog',{name:'Edit contact',exact:true});
  await expect(contact.getByLabel('Driver name',{exact:true})).toBeVisible();await expect(contact.getByLabel('Contact phone',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await contact.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('fleet-contact-tools.png'),fullPage:true});
  await contact.getByRole('button',{name:'Cancel',exact:true}).click();await expect(driver.getByRole('button',{name:'Remove from fleet',exact:true})).toBeVisible();
  });
});
