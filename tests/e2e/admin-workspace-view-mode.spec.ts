import {test,expect as baseExpect} from './browser-test';
const expect=baseExpect.configure({timeout:20000});
import {localAuditService,auditIdentity} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {chmodSync,writeFileSync} from 'node:fs';

test.use({trace:'off',video:'off',screenshot:'off'});
test('Featured and GPS administration start in view mode and explicit tasks cancel without writes',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One browser checks explicit desktop and phone widths.');test.setTimeout(150000);
 const db=localAuditService(),admin=await auditIdentity(db,'admin@loadgistic.local'),logout=await localSupportLogin(page,admin.id);
 const evidence={widths:[] as number[],domainWrites:0,errors:[] as string[],programmeCancelRestoredView:false,gpsCancelRestoredView:false};
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/admin/'))evidence.domainWrites++;});page.on('pageerror',error=>evidence.errors.push(error.name));
 async function capture(name:string){const file=info.outputPath(name);await page.screenshot({path:file,fullPage:true,animations:'disabled'});chmodSync(file,0o600);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 try{
  for(const width of[1440,390]){
   await page.setViewportSize({width,height:900});await page.goto('/admin/featured');await expect(page.getByRole('heading',{name:'Daily Featured on TikTok LIVE',exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:'Save draft',exact:true})).toHaveCount(0);await expect(page.locator('.featured-roster-editor')).toHaveCount(0);await expect(page.locator('.featured-sponsor-form')).toHaveCount(0);await capture(`featured-view-${width}.png`);
   await page.getByRole('button',{name:'Selection settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Selection settings',exact:true});await expect(settings.getByLabel('Selection',{exact:true})).toBeVisible();await settings.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
   await page.getByRole('link',{name:'Edit programme',exact:true}).click();await expect(page.locator('.featured-roster-editor')).toBeVisible();await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Publish this day',exact:true})).toBeVisible();await capture(`featured-edit-${width}.png`);
   await page.getByRole('link',{name:'Cancel editing',exact:true}).click();await expect(page.locator('.featured-roster-editor')).toHaveCount(0);evidence.programmeCancelRestoredView=true;
   await page.goto('/admin/devices');await expect(page.locator('input[name=imei]')).toHaveCount(0);
   await page.getByRole('textbox',{name:'Find transport provider'}).fill('BlueLine');
   await page.getByRole('button',{name:'Search',exact:true}).click();
   await page.getByRole('navigation',{name:'Transport providers'}).getByRole('link',{name:'BlueLine Transport PLC'}).click();
   await page.getByRole('button',{name:'Add GPS device',exact:true}).click();const device=page.getByRole('dialog',{name:'Add GPS device',exact:true});await expect(device.getByRole('combobox',{name:'Demo GPS fixture',exact:true})).toBeVisible();await capture(`gps-registration-task-${width}.png`);await device.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('input[name=imei]')).toHaveCount(0);evidence.gpsCancelRestoredView=true;
   evidence.widths.push(width);
  }
  expect(evidence.domainWrites).toBe(0);expect(evidence.errors).toEqual([]);
 }finally{await logout();writeFileSync(info.outputPath('admin-view-mode-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});}
});
