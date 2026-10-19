import {test,expect} from './browser-test';
import {localAuditService,checked,auditProvider,auditFleetProvider,auditFleetDriver,auditDeleteVehicles} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';
import {getTrackingRecovery} from '../../src/lib/lifecycle.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

test.use({trace:'off',video:'off',screenshot:'off'});
test('real provider and Operations recovery controls match their authoritative actions and save permitted corrections',async({page},info)=>{
 test.setTimeout(180000);page.setDefaultTimeout(15000);
 const db=localAuditService(),actors:any[]=[],drivers:string[]=[],shipments:string[]=[],sessions:Array<()=>Promise<unknown>>=[];
 const evidence:{stage:string;failureStage:string;cleanup:boolean;roles:Record<string,unknown>[];fixtureActors:any[];fixtureDrivers:string[];fixtureShipments:string[]}={stage:'FIXTURES',failureStage:'',cleanup:false,roles:[],fixtureActors:actors,fixtureDrivers:drivers,fixtureShipments:shipments};
 try{
  const places=checked(await db.from('place_catalog').select('id,normalized_name').in('normalized_name',['adama','awash','dire dawa']));
  const place=(name:string)=>{const value=places.find((row:{normalized_name:string})=>row.normalized_name===name);if(!value)throw Error('REQUIRED_PLACE_MISSING');return value.id;};
  for(const kind of ['INDEPENDENT','FLEET']){
   evidence.stage=kind+'_FIXTURES';const actor=kind==='INDEPENDENT'?await auditProvider(db,'recovery-controls'):await auditFleetProvider(db,'recovery-controls');actors.push(actor);
   evidence.stage=kind+'_TRUCK';const truck=await createProviderVehicle(actor,{useBasis:'OWNED',make:'Audit',model:'Recovery controls',plate:'REC-'+actor.suffix,cargoConfiguration:'Mini Box Truck',trailerInterchangeable:false});
   if(kind==='FLEET')drivers.push((await auditFleetDriver(db,actor,truck.id)).id);
   else{evidence.stage=kind+'_SELF_ASSIGNMENT';expect(checked(await db.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);await updateFleetDriverAccess(actor,actor.id,{vehicleId:truck.id,canManageCapacity:true,canManageTracking:true});}
   evidence.stage=kind+'_SHIPMENT';const shipment=await createProviderShipment(actor,{vehicleId:truck.id,originPlaceRef:place('adama'),passingPlaceRef:place('awash'),destinationPlaceRef:place('dire dawa'),cargoSummary:'Synthetic agreed cargo',customerEmail:`owner-${actor.suffix}@example.test`,expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),trackingMode:'LOCATION_AND_STATUS'});shipments.push(shipment.id);
   evidence.stage=kind+'_CONTEXT';const context=await getTrackingRecovery(actor,shipment.id);
   const roleEvidence:Record<string,unknown>={kind,actualActions:context?.actions||null};evidence.roles.push(roleEvidence);
   // Both are provider owners under the October14 fleet contract. A personal
   // owner chooses their own truck explicitly; registration never assigns it.
   expect(context.actions).toEqual(['CORRECT','REASSIGN']);
   evidence.stage=kind+'_LOGIN';sessions.push(await localSupportLogin(page,actor.id));
   evidence.stage=kind+'_NAVIGATION';await page.goto(`/app/provider-shipments/${shipment.id}`,{waitUntil:'domcontentloaded'});
   evidence.stage=kind+'_CONTROLS';
   const recovery=page.getByRole('region',{name:'Tracking recovery',exact:true});await expect(recovery).toBeVisible();
   await expect(recovery.getByRole('button',{name:'Cancel Tracking',exact:true})).toHaveCount(0);
   await expect(recovery.getByRole('button',{name:'Change truck',exact:true})).toHaveCount(1);
   evidence.stage=kind+'_OPEN_CORRECTION';await expect(page.getByRole('textbox',{name:'Cargo summary',exact:true})).toHaveCount(0);await recovery.getByRole('button',{name:'Edit details',exact:true}).click();const correction=page.getByRole('dialog',{name:'Correct Tracking details',exact:true});
   evidence.stage=kind+'_EDIT_CORRECTION';
   // A prefilled textarea contributes text to its wrapping label's textContent.
   // Use its accessible textbox name, as the existing lifecycle workflow does.
   await correction.getByRole('textbox',{name:'Cargo summary',exact:true}).fill('Corrected synthetic agreed cargo');await correction.getByLabel('Reason',{exact:true}).fill('Confirm the agreed cargo description');
   evidence.stage=kind+'_SUBMIT_CORRECTION';const response=page.waitForResponse(result=>new URL(result.url()).pathname===`/api/provider-shipments/${shipment.id}/recovery`&&result.request().method()==='POST');
   await correction.getByRole('button',{name:'Save correction',exact:true}).click();roleEvidence.correctionHttpStatus=(await response).status();
   evidence.stage=kind+'_RESULT';await expect(page.getByText('Tracking updated. Earlier events are retained.',{exact:true})).toBeVisible();
   evidence.stage=kind+'_PERSISTED';
   const saved=checked(await db.from('provider_shipments').select('cargo_summary,operational_status,updated_at').eq('id',shipment.id).single());expect(saved.cargo_summary).toBe('Corrected synthetic agreed cargo');
   evidence.stage=kind+'_DENY';const denial=await page.request.post(`/api/provider-shipments/${shipment.id}/recovery`,{form:{action:'CANCEL',confirm:'CANCEL',reason:'Synthetic denied cancellation',revision:saved.updated_at},maxRedirects:0});expect(denial.status()).toBe(303);expect(new URL(denial.headers().location).searchParams.has('error')).toBe(true);
   expect(checked(await db.from('provider_shipments').select('operational_status').eq('id',shipment.id).single()).operational_status).toBe(saved.operational_status);
   Object.assign(roleEvidence,{correctionSaved:true,forgedCancellationDenied:true});
  }
  evidence.stage='OPERATIONS';const admin=checked(await db.from('profiles').select('id').eq('active',true).eq('role','ADMIN').order('id').limit(1).single());sessions.push(await localSupportLogin(page,admin.id));
  await page.goto(`/admin/operations/tracking/${shipments[1]}`,{waitUntil:'domcontentloaded'});const recovery=page.getByRole('region',{name:'Tracking recovery',exact:true});await expect(recovery).toBeVisible();
  for(const name of ['Edit details','Change truck','Cancel Tracking'])await expect(recovery.getByRole('button',{name,exact:true})).toHaveCount(1);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('operations-permitted-recovery.png'),fullPage:true});
  evidence.roles.push({kind:'OPERATIONS',expectedActions:['CORRECT','REASSIGN','CANCEL'],allControlsVisible:true});evidence.stage='COMPLETE';
 }catch(error){evidence.failureStage=evidence.stage;const safe=error instanceof Error?error.message:'';evidence.roles.push({failureStage:evidence.stage,failureCode:/^[A-Z][A-Z0-9_]{3,70}(?=:| |$)/.exec(safe)?.[0]||null,failureCategory:/plan|subscription/i.test(safe)?'LEGACY_BILLING_FIXTURE':/driver|assign/i.test(safe)?'ASSIGNMENT':/pick.?up|delivery|date|arrival/i.test(safe)?'DATES':/publication|live|draft/i.test(safe)?'LIFECYCLE':'OTHER'});
  const current=evidence.roles.at(-1);if(current){const code=error instanceof Error?error.name:'OTHER';current.failureClass=['Error','TimeoutError','AssertionError','TypeError'].includes(code)?code:'OTHER';const url=new URL(page.url());current.redirectedError=url.searchParams.has('error');
   try{current.correctionInputs=await page.locator('form').filter({has:page.locator('input[name=action][value=CORRECT]')}).evaluateAll(forms=>forms.flatMap(form=>Array.from((form as HTMLFormElement).elements).filter((field):field is HTMLInputElement|HTMLTextAreaElement=>field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement).filter(field=>['action','revision','reason','cargo_summary','origin_place_ref','passing_place_ref','destination_place_ref','expected_pickup_date','expected_delivery_date'].includes(field.name)).map(field=>({name:field.name,valid:field.validity.valid,present:Boolean(field.value)}))));}catch{/* Retain no raw browser diagnostic. */}
   try{await page.screenshot({path:info.outputPath('synthetic-recovery-state.png'),fullPage:true,animations:'disabled',timeout:5000});}catch{/* Diagnostic capture must not block exact cleanup. */}
  }
  throw Error('Tracking recovery workflow failed at '+evidence.stage+'.');}
 finally{
  try{
   for(const close of sessions)await close();
   for(const id of shipments){checked(await db.from('provider_tracking_recoveries').delete().eq('shipment_id',id));checked(await db.from('access_email_deliveries').delete().eq('entity_id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.from('provider_shipments').delete().eq('id',id));}
   for(const actor of actors){const scope=actor.organization_id?'organization_id':'provider_profile_id',id=actor.organization_id||actor.provider_profile_id;const trucks=checked(await db.from('vehicles').select('id').eq(scope,id));for(const row of trucks)checked(await db.from('audit_logs').delete().eq('entity_id',row.id));checked(await auditDeleteVehicles(db,scope,id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.from('audit_logs').delete().eq('actor_user_id',actor.id));}
   for(const id of drivers){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.auth.admin.deleteUser(id));}
   for(const actor of actors){checked(await db.auth.admin.deleteUser(actor.id));if(actor.organization_id)checked(await db.from('organizations').delete().eq('id',actor.organization_id));}
   evidence.cleanup=true;
  }catch{evidence.cleanup=false;}
  const file=info.outputPath('sanitized-recovery-evidence.json');mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify({...evidence,fixtureActors:actors.map(actor=>({id:actor.id,organizationId:actor.organization_id||null,providerProfileId:actor.provider_profile_id||null}))},null,2)+'\n');
  if(!evidence.cleanup)throw Error('Tracking recovery exact fixture cleanup could not be confirmed.');
 }
});
