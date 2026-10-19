import {test,expect as baseExpect} from './browser-test';
import {auditIdentity,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {chmodSync,writeFileSync} from 'node:fs';

const expect=baseExpect.configure({timeout:20000});
test.use({trace:'off',video:'off',screenshot:'off'});
test('task triggers wait for hydration and Accounts directory uses human role labels',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','Shared browser-only readiness contract.');test.setTimeout(90000);
 const db=localAuditService(),admin=await auditIdentity(db,'admin@loadgistic.local'),owner=await auditIdentity(db,'transporter@loadgistic.local'),logout=await localSupportLogin(page,admin.id);
 const evidence={serverRenderedTriggerDisabled:false,hydratedTriggerEnabled:false,explicitTaskOpened:false,cancelRestoredFocus:false,directoryRoleHumanized:false,domainWrites:0};
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/admin/'))evidence.domainWrites++;});
 try{
  // Inspect the actual server-rendered element without executing its scripts.
  // HTML stays in memory; no Auth cookies, email/contact bodies or raw response is saved.
  const response=await page.request.get('/admin/support?tab=team');expect(response.status()).toBe(200);
  const html=await response.text();const disabled=await page.evaluate(markup=>{const document=new DOMParser().parseFromString(markup,'text/html');const buttons=Array.from(document.querySelectorAll('button')).filter(button=>button.textContent?.trim()==='Add member');return buttons.length===1&&buttons[0].disabled;},html);expect(disabled).toBe(true);evidence.serverRenderedTriggerDisabled=true;
  await page.goto('/admin/support?tab=team');const trigger=page.getByRole('button',{name:'Add member',exact:true});await expect(trigger).toBeEnabled();evidence.hydratedTriggerEnabled=true;await expect(page.locator('input[name=email]')).toHaveCount(0);await trigger.click();const dialog=page.getByRole('dialog',{name:'Add member',exact:true});await expect(dialog).toBeVisible();evidence.explicitTaskOpened=true;await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();evidence.cancelRestoredFocus=true;
  await page.goto('/admin/operations?q=Samuel');await expect(page.getByRole('heading',{name:'Accounts',exact:true})).toBeVisible();const ownerRow=page.locator('.admin-record-list article').filter({has:page.locator(`a[href="/admin/operations/users/${owner.id}"]`)});await expect(ownerRow).toHaveCount(1);await expect(ownerRow.locator('small')).toContainText('Transport Provider');await expect(ownerRow.locator('small')).not.toContainText('TRANSPORTER');evidence.directoryRoleHumanized=true;
  const file=info.outputPath('accounts-directory-humanized.png');await page.screenshot({path:file,fullPage:true,animations:'disabled'});chmodSync(file,0o600);expect(evidence.domainWrites).toBe(0);
 }finally{await logout();writeFileSync(info.outputPath('hydration-and-directory-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});}
});
