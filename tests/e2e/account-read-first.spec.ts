import {test,expect} from './browser-test';
import {chmodSync,writeFileSync} from 'node:fs';
import {auditFleetProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test.use({trace:'off',video:'off',screenshot:'off'});
test('Account shows saved facts, explicit editing, isolated tasks and reversible navigation',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One browser covers desktop and phone.');test.setTimeout(180000);
 page.setDefaultTimeout(30000);
 const service=localAuditService(),actor=await auditFleetProvider(service,'account-read');
 let logout:(()=>Promise<unknown>)|undefined;
 const receipt={stage:'ACCOUNT',widths:[] as number[],domainWrites:0,pageErrors:0,shellPreserved:false,cancelRestored:false,profileReadFirst:false,securityReadFirst:false,networkReadFirst:false,networkSearchRestored:false};
 page.on('pageerror',()=>receipt.pageErrors++);
 page.on('request',request=>{if(request.method()==='POST'&&['/api/account','/api/company-page','/api/account-connections','/api/account-capacity-grants'].some(path=>new URL(request.url()).pathname.startsWith(path)))receipt.domainWrites++;});
 async function capture(name:string){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const file=info.outputPath(name);await page.screenshot({path:file,fullPage:true});chmodSync(file,0o600);}
 try{
  logout=await localSupportLogin(page,actor.id);
  for(const width of[1440,390]){
   receipt.stage='ACCOUNT_READ';await page.setViewportSize({width,height:900});await page.goto('/app/more?tab=details');
   await expect(page.getByRole('button',{name:'Edit details',exact:true})).toBeVisible({timeout:30000});await expect(page.getByLabel('First name',{exact:true})).toHaveCount(0);await expect(page.locator('.app-main .page select')).toHaveCount(0);await capture(`account-saved-${width}.png`);
   receipt.stage='ACCOUNT_EDIT_CANCEL';await page.getByRole('button',{name:'Edit details',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Account details',exact:true});const name=dialog.getByLabel('First name',{exact:true}),saved=await name.inputValue();await name.fill('Unsaved owner test');await capture(`account-edit-${width}.png`);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Edit details',exact:true}).click();await expect(page.getByRole('dialog').getByLabel('First name',{exact:true})).toHaveValue(saved);await page.keyboard.press('Escape');receipt.cancelRestored=true;
   receipt.stage='PROFILE_READ';await page.getByRole('navigation',{name:'Account sections'}).getByRole('link',{name:'Transporter profile',exact:true}).click();await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.app-main .page input')).toHaveCount(0);await capture(`profile-saved-${width}.png`);receipt.profileReadFirst=true;
   await page.getByRole('button',{name:'Edit profile',exact:true}).click();await expect(page.getByRole('dialog',{name:'Transporter profile',exact:true}).getByLabel('About the business')).toBeVisible({timeout:30000});await page.keyboard.press('Escape');
   receipt.stage='SECURITY_READ';await page.getByRole('navigation',{name:'Account sections'}).getByRole('link',{name:'Email and account security',exact:true}).click();await expect(page.getByRole('button',{name:'Change login email',exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.app-main .page input')).toHaveCount(0);await capture(`account-security-${width}.png`);receipt.securityReadFirst=true;
   receipt.widths.push(width);
  }
  receipt.stage='NAVIGATION';await page.evaluate(()=>{(window as unknown as {savedShell:Element|null}).savedShell=document.querySelector('.unified-app-frame');});
  await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Network',exact:true}).click();await expect(page).toHaveURL(/\/app\/network/);await expect(page.locator('.unified-app-frame')).toBeVisible({timeout:30000});receipt.shellPreserved=await page.evaluate(()=>(window as unknown as {savedShell:Element|null}).savedShell===document.querySelector('.unified-app-frame'));expect(receipt.shellPreserved).toBe(true);
  receipt.stage='NETWORK_READ';const views=page.getByRole('tablist',{name:'Network views'});await expect(views.getByRole('tab',{name:'Find accounts'})).toHaveAttribute('aria-selected','true');await expect(views.getByRole('tab',{name:'Connections'})).toBeVisible();await expect(views.getByRole('tab',{name:'Vehicle sharing'})).toBeVisible();await expect(page.getByLabel('Share with an email')).toHaveCount(0);receipt.networkReadFirst=true;await capture('network-saved-390.png');
  receipt.stage='NETWORK_SEARCH_RESET';const search=page.getByLabel('Find transport accounts');await search.fill('Unsaved search');await capture('network-search-390.png');await page.getByRole('button',{name:'Clear search'}).click();await expect(search).toHaveValue('');await views.getByRole('tab',{name:'Connections'}).click();await expect(views.getByRole('tab',{name:'Connections'})).toHaveAttribute('aria-selected','true');await views.getByRole('tab',{name:'Find accounts'}).click();await expect(search).toHaveValue('');receipt.networkSearchRestored=true;
  expect(receipt.domainWrites).toBe(0);expect(receipt.pageErrors).toBe(0);receipt.stage='PASS';
 }catch(error){Object.assign(receipt,{failure:{name:error instanceof Error?error.name:'unknown',line:error instanceof Error?error.stack?.match(/account-read-first\.spec\.ts:(\d+)/)?.[1]:null}});const file=info.outputPath('failure.png');await page.screenshot({path:file,fullPage:true}).then(()=>chmodSync(file,0o600)).catch(()=>{});throw error;}finally{
  await logout?.();
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await service.auth.admin.deleteUser(actor.id));
  checked(await service.from('organizations').delete().eq('id',actor.organization_id));
  const file=info.outputPath('account-read-first.json');writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 }
});
