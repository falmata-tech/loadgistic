import {test,expect} from './browser-test';
import {localAuditService,checked,auditIdentity} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {chmodSync,writeFileSync} from 'node:fs';

test.use({trace:'off',video:'off',screenshot:'off'});
test('provider Tracking keeps its record visible and corrections require a deliberate task',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','Explicit phone and desktop widths use the same saved record.');test.setTimeout(120000);
 const db=localAuditService(),actor=await auditIdentity(db,'transporter@loadgistic.local');
 const identity=checked(await db.auth.admin.getUserById(actor.id)).user;
 expect(identity.app_metadata.fixture_source).toBe('loadgistic');expect(identity.user_metadata.fixture_key).toBe('user-transporter');
 const membership=checked(await db.from('organization_members').select('organization_id').eq('user_id',actor.id).eq('membership_role','OWNER').single());
 const records=checked(await db.from('provider_shipments').select('id,updated_at,cargo_summary,assigned_vehicle_id').eq('provider_organization_id',membership.organization_id).in('operational_status',['CREATED','TO_PICKUP','LOADING','IN_TRANSIT']).order('updated_at',{ascending:false}).limit(1));
 expect(records.length,'The managed demo must include an active shipment to review.').toBe(1);
 const shipment=records[0],logout=await localSupportLogin(page,actor.id),evidence={widths:[] as number[],mutationPosts:0,cancelRestoresFocus:false,savedRecordUnchanged:false,browserErrors:[] as string[]};
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/provider-shipments/'))evidence.mutationPosts++;});page.on('pageerror',error=>evidence.browserErrors.push(error.name));
 try{
  for(const width of[1440,390]){
   await page.setViewportSize({width,height:900});await page.goto(`/app/provider-shipments/${shipment.id}`);
   await expect(page.locator('.provider-shipment-summary')).toContainText(shipment.cargo_summary);
   await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('textarea[name=cargo_summary]')).toHaveCount(0);
   const edit=page.getByRole('button',{name:'Edit details',exact:true});await edit.click();const dialog=page.getByRole('dialog',{name:'Correct Tracking details',exact:true});await expect(dialog).toBeVisible();
   await dialog.getByRole('textbox',{name:'Cargo summary',exact:true}).fill('Unsaved synthetic draft');
   const shot=info.outputPath(`tracking-edit-${width}.png`);await page.screenshot({path:shot,fullPage:true,animations:'disabled'});chmodSync(shot,0o600);
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(edit).toBeFocused();evidence.cancelRestoresFocus=true;
   await edit.click();await expect(dialog.getByRole('textbox',{name:'Cargo summary',exact:true})).toHaveValue(shipment.cargo_summary);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
   const recordShot=info.outputPath(`tracking-record-${width}.png`);await page.screenshot({path:recordShot,fullPage:true,animations:'disabled'});chmodSync(recordShot,0o600);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);evidence.widths.push(width);
  }
  expect(checked(await db.from('provider_shipments').select('id,updated_at,cargo_summary,assigned_vehicle_id').eq('id',shipment.id).single())).toEqual(shipment);evidence.savedRecordUnchanged=true;
  expect(evidence.mutationPosts).toBe(0);expect(evidence.browserErrors).toEqual([]);
 }finally{await logout();writeFileSync(info.outputPath('record-view-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});}
});
