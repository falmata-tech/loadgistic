import {test,expect as baseExpect} from './browser-test';
import {auditIdentity,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {randomUUID} from 'node:crypto';
import {chmodSync,writeFileSync} from 'node:fs';

const expect=baseExpect.configure({timeout:20000});
test.use({trace:'off',video:'off',screenshot:'off'});
test('Accounts joins exact owner and employee work and retains context through read/edit/cancel',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One browser verifies both widths.');test.setTimeout(240000);
 const db=localAuditService(),admin=await auditIdentity(db,'admin@loadgistic.local'),owner=await auditIdentity(db,'transporter@loadgistic.local'),employee=await auditIdentity(db,'company-driver@loadgistic.local');
 const membership=checked(await db.from('organization_members').select('organization_id').eq('user_id',owner.id).eq('membership_role','OWNER').single());
 const current=checked(await db.from('driver_vehicle_assignments').select('vehicle_id').eq('driver_user_id',employee.id).eq('active',true).single());
 const allTrucks=checked(await db.from('vehicles').select('id').eq('organization_id',membership.organization_id));
 const ownerShipments=checked(await db.from('provider_shipments').select('id').eq('provider_organization_id',membership.organization_id));
 const employeeShipments=checked(await db.from('provider_shipments').select('id').eq('provider_organization_id',membership.organization_id).eq('assigned_driver_user_id',employee.id));
 const ownerPath=`/admin/operations/users/${owner.id}`,employeePath=`/admin/operations/users/${employee.id}`;
 let logout=await localSupportLogin(page,admin.id),readerId:string|null=null;
 const evidence={stage:'START',widths:[] as number[],ownerTruckTotal:allTrucks.length,employeeTruckTotal:1,employeeTrackingTotal:employeeShipments.length,contextPreserved:false,readOnlyCancelNoWrites:false,customersOnlySectionsDenied:false,supportOnlyAccountsDenied:false,syntheticReaderRemoved:false,errors:[] as string[]};
 page.on('pageerror',error=>evidence.errors.push(error.name));
 async function capture(name:string){const file=info.outputPath(name);await page.screenshot({path:file,fullPage:true,animations:'disabled'});chmodSync(file,0o600);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 try{
  for(const width of[1440,390]){
   evidence.stage=`OWNER_${width}`;await page.setViewportSize({width,height:900});await page.goto('/admin/operations');await expect(page.getByRole('heading',{name:'Accounts',exact:true})).toBeVisible();await expect(page.locator('.admin-view-tabs').getByRole('link',{name:'Provider accounts',exact:true})).toHaveCount(0);
   await page.goto(ownerPath);await expect(page.getByRole('heading',{name:'Provider account',exact:true})).toBeVisible();await expect(page.getByText('Account owner',{exact:true})).toBeVisible();await expect(page.locator('input[name=name]')).toHaveCount(0);
   await expect(page.getByRole('heading',{name:'Fleet',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Open vehicle',exact:true})).toHaveCount(Math.min(5,allTrucks.length));await capture(`account-owner-${width}.png`);
   evidence.stage=`TRUCK_CONTEXT_${width}`;const truckLink=page.getByRole('link',{name:'Open vehicle',exact:true}).first(),truckHref=await truckLink.getAttribute('href');expect(new URL(truckHref!,'http://127.0.0.1:3100').searchParams.get('returnTo')).toContain(ownerPath);await truckLink.click();
   await expect(page.locator('.page-header').getByRole('link',{name:'Account',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Vehicle documents',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await page.locator('.page-header').getByRole('link',{name:'Account',exact:true}).click();await expect(page).toHaveURL(new RegExp(ownerPath));
   if(ownerShipments.length){
    evidence.stage=`TRACKING_CONTEXT_${width}`;await page.getByRole('link',{name:'Open Tracking',exact:true}).first().click();await expect(page.locator('.page-header').getByRole('link',{name:'Account',exact:true})).toBeVisible();
    const edit=page.getByRole('button',{name:'Edit details',exact:true});if(await edit.count()){
     let writes=0;const listener=(request:import('playwright-core').Request)=>{if(request.method()==='POST'&&new URL(request.url()).pathname.includes('/recovery'))writes++;};page.on('request',listener);
     await edit.click();const dialog=page.getByRole('dialog',{name:'Correct Tracking details',exact:true});const returnValue=await dialog.locator('input[name=returnTo]').inputValue();expect(new URL(returnValue,'http://127.0.0.1:3100').searchParams.get('returnTo')).toContain(ownerPath);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);page.off('request',listener);expect(writes).toBe(0);evidence.readOnlyCancelNoWrites=true;
    }
    await page.locator('.page-header').getByRole('link',{name:'Account',exact:true}).click();await expect(page).toHaveURL(new RegExp(ownerPath));
   }
   evidence.stage=`EMPLOYEE_${width}`;await page.goto(employeePath);await expect(page.getByRole('heading',{name:'Works with',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Assigned vehicle',exact:true})).toBeVisible();const employeeTrucks=page.getByRole('link',{name:'Open vehicle',exact:true});await expect(employeeTrucks).toHaveCount(1);expect(await employeeTrucks.first().getAttribute('href')).toContain(current.vehicle_id);await expect(page.getByRole('link',{name:'Open Tracking',exact:true})).toHaveCount(Math.min(5,employeeShipments.length));await capture(`account-employee-${width}.png`);evidence.widths.push(width);
  }
  evidence.contextPreserved=true;
  evidence.stage='CUSTOMERS_ONLY_CREATE';const email=`account-reader-${randomUUID().slice(0,8)}@loadgistic.local`;expect(checked(await db.from('profiles').select('id').eq('email',email))).toEqual([]);await page.goto('/admin/support?tab=team');await page.getByRole('button',{name:'Add member',exact:true}).click();const member=page.getByRole('dialog',{name:'Add member',exact:true});await member.getByLabel('Name',{exact:true}).fill('Synthetic account reader');await member.getByLabel('Sign-in email',{exact:true}).fill(email);await member.getByRole('checkbox',{name:'Support',exact:true}).uncheck();await member.getByRole('checkbox',{name:'Customers',exact:true}).check();await member.getByRole('button',{name:'Create member',exact:true}).click();await expect(page.getByText('Team member created. They can sign in with their email code.',{exact:true})).toBeVisible();readerId=checked(await db.from('profiles').select('id').eq('email',email).single()).id;
  await logout();logout=await localSupportLogin(page,readerId!);evidence.stage='CUSTOMERS_ONLY_READ';await page.goto(ownerPath);await expect(page.getByRole('heading',{name:'Provider account',exact:true})).toBeVisible();await expect(page.getByText('Operations access required',{exact:true})).toHaveCount(2);await expect(page.getByText('Trust access required',{exact:true})).toBeVisible();await expect(page.getByText('Support access required',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Open vehicle',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'View document',exact:true})).toHaveCount(0);await capture('account-customers-only-phone.png');evidence.customersOnlySectionsDenied=true;
  await logout();const support=await auditIdentity(db,'support@loadgistic.local');logout=await localSupportLogin(page,support.id);evidence.stage='SUPPORT_ONLY_DENIAL';await page.goto(ownerPath);await expect(page).toHaveURL(/\/support(?:\?|$)/);evidence.supportOnlyAccountsDenied=true;expect(evidence.errors).toEqual([]);evidence.stage='COMPLETE';
 }catch{throw Error('Account overview workflow failed at '+evidence.stage+'.');}
 finally{
  await logout();if(readerId){checked(await db.from('audit_logs').delete().eq('actor_user_id',readerId));checked(await db.from('audit_logs').delete().eq('entity_id',readerId));checked(await db.auth.admin.deleteUser(readerId));evidence.syntheticReaderRemoved=true;}
  writeFileSync(info.outputPath('account-workflow-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 }
});
