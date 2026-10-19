import {test,expect} from './browser-test';
import {test as apiTest} from 'playwright/test';
import {scopeLocalRequest} from './browser-test-headers.mjs';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {localAuditService,checked} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import type {Page,Browser,BrowserContext} from 'playwright-core';

test.use({trace:'off',video:'off',screenshot:'off'});

// Plain Playwright test: this diagnostic uses API contexts, never a browser.
apiTest('valid existing staff web bearers retain positive Auth and receive mobile WEB_ONLY',async({playwright},info)=>{
 apiTest.setTimeout(120000);const db=localAuditService(),clients:ReturnType<typeof createClient>[]=[],diagnostics:{stage:string;failureStage:string;cleanupFailed:boolean;actors:Record<string,unknown>[]}={stage:'LOCAL_PREFLIGHT',failureStage:'',cleanupFailed:false,actors:[]};
 let context:Awaited<ReturnType<typeof playwright.request.newContext>>|undefined;
 const code=(value:unknown)=>['WEB_ONLY','SIGN_IN_REQUIRED','UNAVAILABLE','INVALID_ORIGIN'].includes(String(value))?String(value):'UNCLASSIFIED';
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const target=new URL(url);if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55321'||!publicKey)throw Error('LOCAL_TARGET_REQUIRED');
  context=await playwright.request.newContext({baseURL:'http://127.0.0.1:3100'});
  const wrapped=scopeLocalRequest(context,()=> '127.0.0.240','http://127.0.0.1:3100');
  for(const role of ['ADMIN','SUPPORT']){
   diagnostics.stage='EXISTING_'+role;
   let query=db.from('profiles').select('id,email,role,active').eq('active',true).eq('role',role);
   if(role==='ADMIN')query=query.eq('email','falmata.dawano@gmail.com');
   const actor=checked(await query.order('id').limit(1).single());
   const evidence:Record<string,unknown>={role,authSubjectMatch:false,globalAuthSubjectMatch:false,projectionSubjectMatch:false,projectionRoleMatch:false,projectionShapeValid:false,reads:[]};diagnostics.actors.push(evidence);
   diagnostics.stage='ISSUE_'+role;
   const link=checked(await db.auth.admin.generateLink({type:'magiclink',email:actor.email}));
   const issuer=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||publicKey,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(issuer);
   const issued=checked(await issuer.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token})).session;
   if(!issued?.access_token||!issued.refresh_token)throw Error('ISSUED_SESSION_REQUIRED');
   const authorization=`Bearer ${issued.access_token}`;
   const positive=await issuer.auth.getUser(issued.access_token);evidence.authSubjectMatch=!positive.error&&positive.data.user?.id===actor.id;
   // Exactly the mobileServer client construction and projection authority.
   const globalClient=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:authorization}}});
   const globalAuth=await globalClient.auth.getUser(issued.access_token);evidence.globalAuthSubjectMatch=!globalAuth.error&&globalAuth.data.user?.id===actor.id;
   const projected=await globalClient.rpc('current_user_projection');
   evidence.projectionSubjectMatch=!projected.error&&projected.data?.id===actor.id;evidence.projectionRoleMatch=projected.data?.role===role;
   evidence.projectionShapeValid=!projected.error&&typeof projected.data?.name==='string'&&typeof projected.data?.email==='string'&&typeof projected.data?.active==='boolean';
   diagnostics.stage='COMPARE_'+role;
   const direct=await fetch('http://127.0.0.1:3100/api/mobile/session',{headers:{Authorization:authorization},signal:AbortSignal.timeout(15000)}),directBody=await direct.json();
   const scoped=await wrapped.get('/api/mobile/session',{headers:{Authorization:authorization},timeout:15000,maxRedirects:0}),scopedBody=await scoped.json();
   const reads=evidence.reads as Record<string,unknown>[];reads.push({transport:'direct',route:'session',status:direct.status,code:code(directBody?.error?.code)},{transport:'wrapped',route:'session',status:scoped.status(),code:code(scopedBody?.error?.code)});
   expect(evidence.authSubjectMatch).toBe(true);expect(evidence.globalAuthSubjectMatch).toBe(true);expect(evidence.projectionSubjectMatch).toBe(true);expect(evidence.projectionRoleMatch).toBe(true);expect(evidence.projectionShapeValid).toBe(true);
   expect(direct.status).toBe(403);expect(directBody.error.code).toBe('WEB_ONLY');expect(scoped.status()).toBe(403);expect(scopedBody.error.code).toBe('WEB_ONLY');
   for(const route of ['dashboard','support','capacity']){diagnostics.stage='READ_'+role+'_'+route;const response=await wrapped.get(`/api/mobile/${route}`,{headers:{Authorization:authorization},timeout:15000,maxRedirects:0}),body=await response.json();reads.push({transport:'wrapped',route,status:response.status(),code:code(body?.error?.code)});expect(response.status()).toBe(403);expect(body.error.code).toBe('WEB_ONLY');}
   diagnostics.stage='REFRESH_'+role;const refreshed=await wrapped.post('/api/mobile/auth/refresh',{data:{refreshToken:issued.refresh_token},timeout:15000,maxRedirects:0}),body=await refreshed.json();reads.push({transport:'wrapped',route:'refresh',status:refreshed.status(),code:code(body?.error?.code)});expect(refreshed.status()).toBe(403);expect(body.error.code).toBe('WEB_ONLY');
  }
 }catch{diagnostics.failureStage=diagnostics.stage;throw Error('Local staff bearer verification failed at '+diagnostics.stage+'.');}
 finally{
  for(const client of clients)try{const result=await client.auth.signOut({scope:'local'});if(result.error)diagnostics.cleanupFailed=true;}catch{diagnostics.cleanupFailed=true;}
  try{await context?.dispose();}catch{diagnostics.cleanupFailed=true;}
  const file=info.outputPath('bearer-diagnostics.json');mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(diagnostics,null,2)+'\n');
  if(diagnostics.cleanupFailed)throw Error('Local staff bearer cleanup could not be confirmed.');
 }
});

function staffHarness(page:Page,browser:Browser,info:{outputPath:(name:string)=>string}){
 const db=localAuditService(),ids:string[]=[],contexts:BrowserContext[]=[];let stage='LOCAL_PREFLIGHT';
 const diagnostics={createdStaffIds:ids,failureStage:'',failureClass:'',cleanupFailure:'',cleanupCode:'',suspension:null as null|{status:number;restoreButtons:number;suspendButtons:number;userActive:boolean;staffActive:boolean;flagsPreserved:boolean},reads:[] as {stage:string;status:number;expected:number}[]};
 const ownerEmail='falmata.dawano@gmail.com';let owner:{id:string;role:string;active:boolean}|null=null;
 async function status(p:Page,url:string,expected:number){const response=await p.request.get(url,{maxRedirects:0});diagnostics.reads.push({stage,status:response.status(),expected});expect(response.status()).toBe(expected);}
 async function preflight(){
  for(const table of ['support_conversations']){
   const queued=await db.from(table).select('id',{count:'exact',head:true}).eq('status','WAITING').is('assigned_agent_user_id',null);
   if(queued.error)throw Error('LOCAL_STAFF_QUEUE_PREFLIGHT_FAILED');expect(queued.count,'Staff maintenance needs an empty local waiting queue').toBe(0);
  }
 }
 async function ownerLogin(){
  stage='OWNER_SETUP';owner=checked(await db.from('profiles').select('id,role,active').eq('email',ownerEmail).single());
  if(!owner||owner.role!=='ADMIN'||owner.active!==true)throw Error('EXISTING_LOCAL_OWNER_REQUIRED');
  await webLogin(page,ownerEmail,/\/admin$/);await page.goto('/admin/support?tab=team');await expect(page.getByRole('heading',{name:'Platform team',exact:true})).toBeVisible();
 }
 async function webLogin(p:Page,email:string,destination:RegExp){
  stage='WEB_LOGIN';
  await p.goto('/login');const requestedAt=Date.now();await p.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);
  await p.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(p.getByTestId('email-code-form')).toBeVisible();
  const code=await localMailpitNumericCode(email,requestedAt,['Your Loadgistic signup code','Your Loadgistic sign-in code']);
  await p.getByLabel('Six-digit code',{exact:true}).fill(code);await p.getByRole('button',{name:'Continue',exact:true}).click();await expect(p).toHaveURL(destination,{timeout:30000});
 }
 async function assertMobileBlocked(p:Page,email:string,id:string){
  stage='MOBILE_WEB_ONLY';
  const context=await browser.newContext({viewport:{width:412,height:915}});contexts.push(context);const app=await context.newPage();
  await app.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});await app.getByRole('textbox',{name:'Email',exact:true}).fill(email);
  const requestedAt=Date.now(),requested=app.waitForResponse(r=>r.url().endsWith('/api/mobile/auth/request')&&r.request().method()==='POST');await app.getByRole('button',{name:'Send code',exact:true}).click();expect((await requested).status()).toBe(200);await expect(app.getByRole('textbox',{name:'Sign-in code',exact:true})).toBeVisible({timeout:30000});
  const code=await localMailpitNumericCode(email,requestedAt,['Your Loadgistic signup code','Your Loadgistic sign-in code']);await app.getByRole('textbox',{name:'Sign-in code',exact:true}).fill(code);
  const result=app.waitForResponse(r=>r.url().endsWith('/api/mobile/auth/verify')&&r.request().method()==='POST');await app.getByRole('button',{name:'Sign in',exact:true}).click();const response=await result;
  expect(response.status()).toBe(403);const denial=await response.json();expect(denial.error.code).toBe('WEB_ONLY');expect(denial.accessToken).toBeUndefined();expect(denial.refreshToken).toBeUndefined();
  await expect(app.getByText('Use the website for staff access.',{exact:true}).first()).toBeVisible();expect(await app.evaluate(()=>sessionStorage.getItem('loadgistic.account.refresh.v1'))).toBeNull();
  await app.screenshot({path:info.outputPath(`web-only-${id}.png`),mask:[app.getByRole('textbox',{name:'Sign-in code',exact:true})]});
  if(id===owner!.id)expect((await p.request.get('/admin/support',{maxRedirects:0})).status()).toBe(200);
 }
 async function teamForm(id:string){
  await page.goto('/admin/support?tab=team');
  const form=page.locator(`form[action="/api/admin/support-agents/${id}"]`),row=page.locator(`[data-member-id="${id}"]`);
  const result=await db.from('support_agent_profiles').select('user_id',{count:'exact',head:true});
  if(result.error)throw new Error('LOCAL_STAFF_PAGING_PREFLIGHT_FAILED');
  const pages=Math.max(1,Math.ceil((result.count||0)/10));
  for(let current=1;current<pages&&!await row.count();current++){
   await page.locator('.admin-support-team').getByRole('link',{name:'Next page',exact:true}).click();
   await expect(page).toHaveURL(new RegExp(`[?&]agentPage=${current+1}(?:&|$)`));
  }
  await expect(row).toHaveCount(1);await row.getByRole('button',{name:'Edit member',exact:true}).click();await expect(form).toHaveCount(1);return form;
 }
 async function checkStaffMaintenance(staff:Page,id:string){
  stage='STAFF_PERMISSIONS_TEAM';
  const fields='active,available,max_open_conversations,can_manage_customers,can_manage_operations,can_manage_trust,can_manage_billing,can_manage_support,can_manage_brokerage,can_manage_featured';
  const snapshot=()=>db.from('support_agent_profiles').select(fields).eq('user_id',id).single().then(checked);
  const form=await teamForm(id);
  stage='STAFF_PERMISSIONS_OPEN';
  stage='STAFF_PERMISSIONS_EDIT';
  await form.getByRole('checkbox',{name:'Available for chats',exact:true}).uncheck();
  await form.getByLabel('Max open chats',{exact:true}).fill('4');
  await form.getByRole('checkbox',{name:'Featured',exact:true}).check();
  stage='STAFF_PERMISSIONS_SAVE';
  await form.getByRole('button',{name:'Save permissions',exact:true}).click();
  await expect(page.getByText('Support agent updated.',{exact:true})).toBeVisible();
  stage='STAFF_PERMISSIONS_SNAPSHOT';
  const assigned=await snapshot();
  expect(assigned).toEqual({active:true,available:false,max_open_conversations:4,
   can_manage_customers:false,can_manage_operations:false,can_manage_trust:false,can_manage_billing:false,
   can_manage_support:true,can_manage_brokerage:false,can_manage_featured:true});
  const updates='/api/support/updates';
  stage='STAFF_PERMISSIONS_ACCESS';
  await status(staff,updates,200);
  await status(staff,'/admin/featured',200);
  stage='STAFF_SUSPEND';
  await page.goto(`/admin/operations/users/${id}`);
  const suspended=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/admin/records/user/${id}`&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Suspend account',exact:true}).click();await page.getByRole('dialog',{name:'Suspend account',exact:true}).getByRole('button',{name:'Suspend account',exact:true}).click();
  const suspensionResponse=await suspended,current=await snapshot(),profile=checked(await db.from('profiles').select('active').eq('id',id).single());
  diagnostics.suspension={status:suspensionResponse.status(),restoreButtons:await page.getByRole('button',{name:'Restore account',exact:true}).count(),suspendButtons:await page.getByRole('button',{name:'Suspend account',exact:true}).count(),userActive:profile.active,staffActive:current.active,flagsPreserved:Object.entries(assigned).every(([key,value])=>key==='active'||current[key]===value)};
  await expect(page.getByRole('button',{name:'Restore account',exact:true})).toBeVisible();
  expect(await snapshot()).toEqual({...assigned,active:false});
  expect(checked(await db.from('profiles').select('role,active').eq('id',id).single())).toEqual({role:'SUPPORT',active:false});
  await status(staff,updates,401);
  stage='STAFF_RESTORE';await page.getByRole('button',{name:'Restore account',exact:true}).click();await page.getByRole('dialog',{name:'Restore account',exact:true}).getByRole('button',{name:'Restore account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Suspend account',exact:true})).toBeVisible();
  expect(await snapshot()).toEqual(assigned);
  await status(staff,updates,200);
  await status(staff,'/admin/featured',200);
  // Only the explicit permission editor may revoke a responsibility.
  stage='STAFF_REVOKE';await teamForm(id);
  await form.getByRole('checkbox',{name:'Support',exact:true}).uncheck();
  await form.getByRole('button',{name:'Save permissions',exact:true}).click();
  await expect(page.getByText('Support agent updated.',{exact:true})).toBeVisible();
  expect(await snapshot()).toEqual({...assigned,can_manage_support:false,can_manage_brokerage:false});
  await status(staff,updates,403);
  await status(staff,'/admin/featured',200);
 }
 async function responsibility(){
   stage='STAFF_CREATE';
   const email=`staff-owner-audit-support-${randomUUID()}@example.test`,form=page.locator('form[action="/api/admin/support-agents"]');
   await page.getByRole('button',{name:'Add member',exact:true}).click();await form.getByLabel('Name',{exact:true}).fill('Audit Support');await form.getByLabel('Sign-in email',{exact:true}).fill(email);
   await form.locator('[name=canManageSupport]').setChecked(true);await expect(form.locator('[name=canManageBrokerage]')).toHaveCount(0);await form.getByRole('button',{name:'Create member',exact:true}).click();await expect(page).toHaveURL(/\/admin\/support\?tab=team&success=/);
   const user=checked(await db.from('profiles').select('id,role,active').eq('email',email).single());ids.push(user.id);expect(user.role).toBe('SUPPORT');expect(user.active).toBe(true);
   const permissions=checked(await db.from('support_agent_profiles').select('*').eq('user_id',user.id).single());expect(permissions.can_manage_support).toBe(true);expect(permissions.can_manage_brokerage).toBe(false);
   for(const field of ['can_manage_customers','can_manage_operations','can_manage_trust','can_manage_billing','can_manage_featured'])expect(permissions[field]).toBe(false);
   const context=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:page.viewportSize()!});contexts.push(context);const staff=await context.newPage();await webLogin(staff,email,/\/support$/);
   expect((await staff.request.post('/api/admin/support-agents',{form:{name:'Forbidden',email:`denied-${randomUUID()}@example.test`}})).status()).toBe(403);
   await status(staff,'/api/brokerage/updates',410);await expect(staff.locator('.sidebar-nav a[href="/brokerage"]')).toHaveCount(0);
   await checkStaffMaintenance(staff,user.id);
   await assertMobileBlocked(staff,email,user.id);
 }
 async function ownerOnly(){
  if(!owner)throw Error('EXISTING_LOCAL_OWNER_REQUIRED');await assertMobileBlocked(page,ownerEmail,owner.id);
  stage='STAFF_RESPONSIVE';
  for(const width of [412,1440]){await page.setViewportSize({width,height:915});await page.goto('/admin/support?tab=team');await page.screenshot({path:info.outputPath(`owner-admin-${width}.png`),fullPage:true,mask:[page.locator('.admin-support-queue'),page.locator('.support-agent-list')]});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 }
 async function run(action:()=>Promise<void>){
  try{await action();}catch(error){diagnostics.failureStage=stage;const name=error instanceof Error?error.name:'';diagnostics.failureClass=['Error','TimeoutError','AssertionError','TypeError'].includes(name)?name:'OTHER';throw Error('Local staff maintenance failed at '+stage+'.');}
  finally{
  let cleanupPhase='';
  const cleanupChecked=(result:{error:unknown})=>{if(result.error){const code=(result.error as {code?:unknown}).code;diagnostics.cleanupCode=typeof code==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(code)?code:'UNCLASSIFIED';throw new Error('LOCAL_FIXTURE_CLEANUP_FAILED');}};
  try{
   let contextCloseFailed=false;
   cleanupPhase='BROWSER_CONTEXT';for(const context of contexts)try{await context.close();}catch{contextCloseFailed=true;}
   for(const id of ids){cleanupPhase='STAFF_ACTOR_AUDIT';cleanupChecked(await db.from('audit_logs').delete().eq('actor_user_id',id));cleanupPhase='STAFF_ENTITY_AUDIT';cleanupChecked(await db.from('audit_logs').delete().eq('entity_id',id));cleanupPhase='STAFF_AUTH';cleanupChecked(await db.auth.admin.deleteUser(id));}
   if(contextCloseFailed){cleanupPhase='BROWSER_CONTEXT';throw new Error('LOCAL_BROWSER_CLEANUP_FAILED');}
  }catch{diagnostics.cleanupFailure=cleanupPhase;throw new Error('Local staff maintenance fixture cleanup failed.');}
  finally{const file=info.outputPath('maintenance-diagnostics.json');mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(diagnostics,null,2)+'\n');}

  }
 }
 return{run,preflight,ownerLogin,responsibility,ownerOnly};
}

test('Support staff permissions survive activation and explicit revocation; mobile OTP remains web-only',async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(240000);const harness=staffHarness(page,browser,info);
 await harness.run(async()=>{await harness.preflight();await harness.ownerLogin();await harness.responsibility();});
});

test('existing owner administrator remains web-only and retains responsive web access',async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(240000);const harness=staffHarness(page,browser,info);
 await harness.run(async()=>{await harness.ownerLogin();await harness.ownerOnly();});
});
