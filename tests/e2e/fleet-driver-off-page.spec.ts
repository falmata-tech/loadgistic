import {mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {test,expect as baseExpect} from './browser-test';
import {localAuditService,auditFleetProvider,auditDeleteVehicles} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {addFleetDriver} from '../../src/lib/fleet-driver-management';
import {createProviderVehicle,getFleetDriverPage,updateFleetDriverAccess} from '../../src/lib/fleet.js';

const expect=baseExpect.configure({timeout:30000});
test.use({trace:'off',video:'off',screenshot:'off',actionTimeout:30000,navigationTimeout:30000});
test('truck management opens its assigned driver beyond page one and denies another fleet',async({browser},info)=>{
 test.skip(process.env.LOADGISTIC_OFF_PAGE_FLEET_REVIEW!=='1','Explicit local synthetic fixture check.');test.skip(info.project.name!=='desktop-chromium','One serial desktop/phone workflow.');test.setTimeout(180000);
 const service=localAuditService(),folder=path.resolve('.local/fleet-driver-detail-20261015');mkdirSync(folder,{recursive:true,mode:0o700});
 const owned={ownerId:'',ownerEmail:'',orgId:'',otherId:'',otherEmail:'',otherOrgId:'',truckId:'',driverIds:[] as string[],driverEmails:[] as string[]};
 const proof={stage:'START',complete:false,cleaned:false,firstPageSize:0,totalDrivers:0,targetOffPage:false,correctDriver:false,assignmentEditor:false,foreignDenied:false,noForeignContact:false,pageErrors:0,fit:[] as boolean[]};
 function record(stage=proof.stage){proof.stage=stage;writeFileSync(path.join(folder,'owned.json'),JSON.stringify(owned,null,2),{mode:0o600});writeFileSync(path.join(folder,'evidence.json'),JSON.stringify(proof,null,2),{mode:0o600});}
 function data<T>(result:{data:T;error:unknown}):T{if(result.error)throw Error('LOCAL_FIXTURE_OPERATION_FAILED');return result.data;}
 const ownerContext=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:{width:390,height:844}}),otherContext=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:{width:390,height:844}});
 const page=await ownerContext.newPage(),otherPage=await otherContext.newPage();page.on('pageerror',()=>proof.pageErrors++);otherPage.on('pageerror',()=>proof.pageErrors++);
 let ownerLogout:(()=>Promise<unknown>)|null=null,otherLogout:(()=>Promise<unknown>)|null=null,primary:unknown;
 async function capture(target:typeof page,name:string){const file=path.join(folder,name);await target.screenshot({path:file,fullPage:true});chmodSync(file,0o600);proof.fit.push(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 try{
  record('CREATE_ISOLATED_OWNERS');const owner=await auditFleetProvider(service,'offpage-owner');Object.assign(owned,{ownerId:owner.id,ownerEmail:owner.email,orgId:owner.organization_id});record();
  const outsider=await auditFleetProvider(service,'offpage-outsider');Object.assign(owned,{otherId:outsider.id,otherEmail:outsider.email,otherOrgId:outsider.organization_id});record('CREATE_ISOLATED_DRIVERS');
  for(let index=0;index<13;index++){
   const email=`offpage-driver-${owner.suffix}-${index}@loadgistic.local`;owned.driverEmails.push(email);record();
   if(data(await service.from('profiles').select('id').eq('email',email).maybeSingle()))throw Error('FIXTURE_EMAIL_ALREADY_EXISTS');
   const id=await addFleetDriver(owner.id,{email,name:index===12?'ZZ Final Driver':`Synthetic Driver ${String(index).padStart(2,'0')}`,phone:'+251900000013'});owned.driverIds.push(id);record();
  }
  record('ASSIGN_LAST_DRIVER');const created=await createProviderVehicle(owner,{useBasis:'PERMISSION',make:'Synthetic',model:'Off page truck',plate:'OFFPAGE-'+owner.suffix,cargoConfiguration:'Mini Box Truck'});owned.truckId=typeof created==='string'?created:created.id;record();
  const targetId=owned.driverIds[12];await updateFleetDriverAccess(owner,targetId,{vehicleId:owned.truckId,canManageCapacity:true,canManageTracking:false});
  const first=await getFleetDriverPage(owner,{page:1,pageSize:10});proof.firstPageSize=first.items.length;proof.totalDrivers=first.total;proof.targetOffPage=!first.items.some((driver:{id:string})=>driver.id===targetId);expect(proof.firstPageSize).toBe(10);expect(proof.totalDrivers).toBe(13);expect(proof.targetOffPage).toBe(true);record('OPEN_TRUCK_DRIVER');
  ownerLogout=await localSupportLogin(page,owner.id);await page.goto('/app/fleet/'+owned.truckId,{waitUntil:'domcontentloaded'});await page.getByRole('link',{name:'Manage driver',exact:true}).click();
  await expect(page.getByRole('heading',{name:'ZZ Final Driver',exact:true})).toBeVisible();await expect(page.getByText('Synthetic Off page truck · LG-', {exact:false}).first()).toBeVisible();proof.correctDriver=true;
  await page.getByRole('button',{name:'Edit assignment',exact:true}).click();const editor=page.getByRole('dialog',{name:'Assigned vehicle',exact:true});await expect(editor.getByLabel('Vehicle',{exact:true})).toHaveValue(owned.truckId);await expect(editor.getByLabel('Capacity updates',{exact:true})).toBeChecked();await expect(editor.getByLabel('Tracking updates',{exact:true})).not.toBeChecked();await editor.getByRole('button',{name:'Cancel',exact:true}).click();proof.assignmentEditor=true;await capture(page,'off-page-driver-phone.png');record('FOREIGN_DENIAL');
  otherLogout=await localSupportLogin(otherPage,outsider.id);await otherPage.goto('/app/fleet?view=drivers&driver='+targetId,{waitUntil:'domcontentloaded'});await expect(otherPage.getByRole('alert')).toHaveText('This driver is no longer available in your fleet.');await expect(otherPage.getByText('ZZ Final Driver',{exact:true})).toHaveCount(0);await expect(otherPage.getByText('+251900000013',{exact:true})).toHaveCount(0);proof.foreignDenied=true;proof.noForeignContact=true;await capture(otherPage,'foreign-driver-denied-phone.png');
  expect(proof.pageErrors).toBe(0);expect(proof.fit.every(Boolean)).toBe(true);proof.complete=true;record('COMPLETE');
 }catch(error){primary=error;record();}
 finally{
  try{
   await ownerLogout?.();await otherLogout?.();record('CLEANUP');
   for(const [id,email]of [[owned.ownerId,owned.ownerEmail],[owned.otherId,owned.otherEmail],...owned.driverIds.map((id,index)=>[id,owned.driverEmails[index]])].filter(([id])=>id)){
    const identity=z.object({user:z.object({email:z.string()}).nullable()}).parse(data(await service.auth.admin.getUserById(id))).user;if(identity?.email!==email)throw Error('FIXTURE_IDENTITY_CHANGED');
   }
   for(const orgId of [owned.orgId,owned.otherOrgId].filter(Boolean)){
    const ids=z.array(z.object({id:z.string().uuid()}));
    if(ids.parse(data(await service.from('provider_shipments').select('id').eq('provider_organization_id',orgId).limit(1))).length||ids.parse(data(await service.from('support_conversations').select('id').in('customer_user_id',[owned.ownerId,owned.otherId,...owned.driverIds].filter(Boolean)).limit(1))).length)throw Error('FIXTURE_HAS_UNEXPECTED_WORK');
   }
   if(owned.truckId){data(await service.from('driver_vehicle_assignments').delete().eq('vehicle_id',owned.truckId));data(await service.from('capacities').delete().eq('vehicle_id',owned.truckId));data(await auditDeleteVehicles(service,'id',owned.truckId));}
   if(owned.orgId&&owned.driverIds.length)data(await service.from('drivers').delete().eq('organization_id',owned.orgId).in('user_id',owned.driverIds));
   const actors=[owned.ownerId,owned.otherId,...owned.driverIds].filter(Boolean);if(actors.length){data(await service.from('audit_logs').delete().in('actor_user_id',actors));data(await service.from('provider_signup_intents').delete().in('auth_user_id',actors));}
   for(const id of [...owned.driverIds,owned.ownerId,owned.otherId].filter(Boolean))data(await service.auth.admin.deleteUser(id));
   for(const orgId of [owned.orgId,owned.otherOrgId].filter(Boolean))data(await service.from('organizations').delete().eq('id',orgId));
   if(actors.length)expect(data(await service.from('profiles').select('id').in('id',actors))).toHaveLength(0);proof.cleaned=true;
  }catch(error){if(!primary)primary=error;}
  finally{await ownerContext.close();await otherContext.close();record(proof.complete&&proof.cleaned?'COMPLETE':'FAILED');}
 }
 if(primary)throw Error('OFF_PAGE_FLEET_FAILED_'+proof.stage);expect(proof.complete&&proof.cleaned).toBe(true);
});
