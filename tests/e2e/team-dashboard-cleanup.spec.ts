import {test,expect} from './browser-test';
import {chmodSync,writeFileSync} from 'node:fs';
import {auditIdentity,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test.use({trace:'off',video:'off',screenshot:'off'});
async function capture(page:any,info:any,name:string){
 const file=info.outputPath(name);await page.screenshot({path:file,fullPage:true});chmodSync(file,0o600);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
test('admin support and Team controls fit desktop and phones while brokerage stays retired',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One actual browser checks all three explicit widths.');test.setTimeout(150000);
 const db=localAuditService(),admin=await auditIdentity(db,'admin@loadgistic.local'),logout=await localSupportLogin(page,admin.id);
 const evidence={widths:[] as number[],teamDraftKept:false,teamPollingRequests:0,retiredBrokeragePages:0,domainWrites:0};let watchTeam=false;
 page.on('request',request=>{const url=new URL(request.url());if(watchTeam&&url.pathname==='/api/support/updates')evidence.teamPollingRequests++;if(request.method()==='POST'&&/^\/api\/(admin|support|brokerage)\//.test(url.pathname))evidence.domainWrites++;});
 try{
  for(const width of[1440,390,320]){
   await page.setViewportSize({width,height:900});await page.goto('/admin/support?tab=chats&view=WAITING&queuePage=1');
   await expect(page.getByRole('heading',{name:'Provider support',exact:true})).toBeVisible();
   await expect(page.locator('form[action="/api/admin/support-agents"]')).toHaveCount(0);
   await expect(page.getByRole('link',{name:'Guest support',exact:true})).toHaveCount(0);
   if(width<980){const nav=page.getByRole('navigation',{name:'Mobile navigation',exact:true});const more=nav.getByRole('button',{name:'More',exact:true});await expect(more).toBeVisible();await more.click();const menu=page.getByRole('dialog',{name:'More navigation'});await expect(menu.getByRole('link',{name:'Support',exact:true})).toBeVisible();await expect(menu.getByRole('link',{name:'Brokerage',exact:true})).toHaveCount(0);await menu.getByRole('button',{name:'Close menu'}).click();}
   await capture(page,info,`admin-provider-support-${width}.png`);
   await page.getByRole('navigation',{name:'Support workspace',exact:true}).getByRole('link',{name:'Team',exact:true}).click();
   const form=page.locator('form[action="/api/admin/support-agents"]');await expect(form).toHaveCount(0);await page.getByRole('button',{name:'Add member',exact:true}).click();await expect(page.getByRole('dialog',{name:'Add member',exact:true})).toBeVisible();
   for(const label of['Customers','Operations','Trust','Support','Featured'])await expect(form.getByRole('checkbox',{name:label,exact:true})).toBeVisible();
   await expect(form.getByRole('checkbox',{name:'Brokerage',exact:true})).toHaveCount(0);
   await expect(form.getByLabel('Max open chats')).toHaveAttribute('min','1');await expect(form.getByLabel('Max open chats')).toHaveAttribute('max','20');
   if(width===1440){watchTeam=true;await form.getByLabel('Name',{exact:true}).fill('Unsaved synthetic draft');await page.waitForTimeout(6500);await expect(form.getByLabel('Name',{exact:true})).toHaveValue('Unsaved synthetic draft');evidence.teamDraftKept=true;watchTeam=false;}
   await capture(page,info,`admin-team-${width}.png`);await page.getByRole('dialog',{name:'Add member',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();await expect(form).toHaveCount(0);await expect(page.getByRole('button',{name:'Add member',exact:true})).toBeFocused();await capture(page,info,`admin-team-list-${width}.png`);
   await page.goto('/brokerage?queue=ALL&view=ALL&page=1');await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
   await expect(page.locator('.transport-request-card')).toHaveCount(0);evidence.retiredBrokeragePages++;
   await capture(page,info,`admin-retired-brokerage-${width}.png`);evidence.widths.push(width);
  }

  expect(evidence.teamPollingRequests).toBe(0);expect(evidence.domainWrites).toBe(0);
 }finally{await logout();const file=info.outputPath('admin-cleanup-evidence.json');writeFileSync(file,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});chmodSync(file,0o600);}
});

test('Support staff can reach sign-out from the phone header without additional queue access',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One actual browser checks explicit phone width.');test.setTimeout(60000);
 const db=localAuditService(),staff=await auditIdentity(db,'support@loadgistic.local');
 const permissions=checked(await db.from('support_agent_profiles').select('active,can_manage_support,can_manage_brokerage').eq('user_id',staff.id).single());
 expect(permissions.active&&permissions.can_manage_support).toBe(true);const logout=await localSupportLogin(page,staff.id);
 const started=Date.now(),diagnostic={pageErrors:[] as string[],pageErrorKinds:[] as string[],logoutRequests:0,logoutResponses:[] as number[],logoutFailures:[] as string[],navigation:[] as {path:string,atMs:number}[],requests:[] as {kind:string,atMs:number}[],apiFallback:null as null|{status:number,destination:string,remoteConfirmed:boolean}|{failure:string},nativeFormReady:false};
 const knownPath=(value:string)=>{const path=new URL(value).pathname;return['/support','/login','/api/auth/logout','/api/support/updates'].includes(path)?path:'OTHER';};
 page.on('pageerror',error=>{diagnostic.pageErrors.push(error.name);diagnostic.pageErrorKinds.push(/NEXT_REDIRECT/.test(error.message)?'NEXT_REDIRECT':/form.*unexpectedly submitted/i.test(error.message)?'UNEXPECTED_FORM':/hydration/i.test(error.message)?'HYDRATION':/content security policy|CSP/i.test(error.message)?'CSP':/fetch/i.test(error.message)?'FETCH':'OTHER');});
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())diagnostic.navigation.push({path:knownPath(frame.url()),atMs:Date.now()-started});});
 page.on('request',request=>{const path=knownPath(request.url());if(path==='/api/auth/logout')diagnostic.logoutRequests++;if(path!=='OTHER')diagnostic.requests.push({kind:request.headers().rsc==='1'?'RSC_REFRESH':request.method()+' '+path,atMs:Date.now()-started});});
 page.on('response',response=>{if(new URL(response.url()).pathname==='/api/auth/logout')diagnostic.logoutResponses.push(response.status());});
 page.on('requestfailed',request=>{if(new URL(request.url()).pathname==='/api/auth/logout'){const reason=request.failure()?.errorText||'';diagnostic.logoutFailures.push(/^net::ERR_[A-Z_]+$/.test(reason)?reason:'REQUEST_FAILED');}});
 try{
  await page.setViewportSize({width:390,height:844});await page.goto('/support');await expect(page.getByRole('heading',{name:'Provider support',exact:true})).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Mobile navigation',exact:true});await expect(nav.getByRole('link',{name:'Support',exact:true})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Brokerage',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Guest support',exact:true})).toHaveCount(0);
  const account=page.locator('.public-session-compact summary[aria-label="Account"]');await expect(account).toHaveCount(1);await expect(account).toBeVisible();
  await account.click();const signOut=page.getByRole('button',{name:'Log out',exact:true});
  await expect(signOut).toBeVisible();await signOut.click({trial:true});await capture(page,info,'staff-phone-account.png');
  const signOutForm=signOut.locator('..');await expect(signOutForm).toHaveAttribute('action','/api/auth/logout');await expect(signOutForm).toHaveAttribute('method','post');diagnostic.nativeFormReady=true;
  const signedOut=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/logout'&&response.request().method()==='POST',{timeout:20000});
  await signOut.click();expect((await signedOut).status()).toBe(303);await expect(page).toHaveURL(/\/\?success=/,{timeout:30000});
 }catch(error){
  if(process.env.LOADGISTIC_LOGOUT_DIAGNOSIS==='1'){
   try{const result=await page.request.post('/api/auth/logout',{maxRedirects:0,timeout:8000});const destination=new URL(result.headers().location||'/login','http://127.0.0.1:3100');diagnostic.apiFallback={status:result.status(),destination:knownPath(String(destination)),remoteConfirmed:destination.searchParams.has('success')};}catch{diagnostic.apiFallback={failure:'NO_BOUNDED_RESPONSE'};}
  }
  throw error;
 }finally{const file=info.outputPath('staff-account-evidence.json');writeFileSync(file,JSON.stringify(diagnostic,null,2)+'\n',{mode:0o600});chmodSync(file,0o600);await logout();}
});


test('retired general Guest support remains unavailable after dashboard restructuring',async({page})=>{
 test.skip(test.info().project.name!=='desktop-chromium','One focused route-denial check.');test.setTimeout(60000);
 const db=localAuditService(),admin=await auditIdentity(db,'admin@loadgistic.local'),logout=await localSupportLogin(page,admin.id);
 try{await page.goto('/support/assisted');await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();await expect(page.locator('.guest-support-thread')).toHaveCount(0);}finally{await logout();}
});
