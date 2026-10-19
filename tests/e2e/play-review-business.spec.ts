import {randomBytes,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {test,expect} from './browser-test';

// The review credentials exercise the ordinary mobile Auth and business APIs.
// This fixture never points at a hosted project or a customer identity.
function localReviewService(){
 nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
 const endpoint=process.env.LOADGISTIC_REVIEW_E2E_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'';
 const url=new URL(endpoint);
 if(!['127.0.0.1','localhost'].includes(url.hostname)
  ||url.port!=='55321'&&!(url.port==='56321'&&process.env.LOADGISTIC_REVIEW_E2E_LOCAL_STACK==='1'))
  throw Error('LOCAL_REVIEW_DATABASE_REQUIRED');
 const key=process.env.LOADGISTIC_REVIEW_E2E_SERVICE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 if(!key)throw Error('LOCAL_REVIEW_SERVICE_KEY_REQUIRED');
 return createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function checked<T>(result:{data:T;error:{code?:string}|null},label:string):T{
 if(result.error)throw Error(`${label}:${result.error.code||'DATABASE_ERROR'}`);
 return result.data;
}
function requireId(value:unknown,label:string):string{
 if(!value||typeof value!=='object'||!('id' in value)||typeof value.id!=='string'||!value.id)
  throw Error(`${label}:MISSING_ID`);
 return value.id;
}
function requireCreatedUserId(value:unknown):string{
 if(!value||typeof value!=='object'||!('user' in value))throw Error('CREATE_REVIEW_USER:MISSING_USER');
 return requireId(value.user,'CREATE_REVIEW_USER');
}
function localSql(statement:string){
 const endpoint=new URL(process.env.LOADGISTIC_REVIEW_E2E_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'');
 const container=endpoint.port==='56321'&&process.env.LOADGISTIC_REVIEW_E2E_LOCAL_STACK==='1'
  ?'supabase_db_loadgistic-review-e2e-20261019':endpoint.port==='55321'?'supabase_db_loadgistic-local':null;
 if(!container)throw Error('LOCAL_REVIEW_SQL_REQUIRED');
 return execFileSync('docker',['exec',container,'psql','-X','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',statement],
  {encoding:'utf8',timeout:12000,stdio:['ignore','pipe','pipe']}).trim();
}

test.use({trace:'off',video:'off',screenshot:'off',actionTimeout:20_000,navigationTimeout:35_000});
test('Play reviewer owner and teammate use one private business workspace through the Expo UI',async({browser},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One phone-sized browser covers both reviewer roles.');
 test.setTimeout(240_000);
 const service=localReviewService(),nonce=randomUUID().slice(0,8),preview=process.env.LOADGISTIC_REVIEW_E2E_PREVIEW_URL||'http://localhost:8084';
 if(!/^[0-9a-f]{8}$/.test(nonce))throw Error('INVALID_LOCAL_REVIEW_NONCE');
 const directApi=process.env.LOADGISTIC_REVIEW_E2E_DIRECT_API_URL;
 if(directApi&&new URL(directApi).origin!=='http://127.0.0.1:3110')throw Error('LOCAL_REVIEW_DIRECT_API_REQUIRED');
 const ownerEmail=`play-owner-${nonce}@loadgistic.local`,staffEmail=`play-staff-${nonce}@loadgistic.local`;
 const password=randomUUID()+randomUUID(),created:{users:string[];profiles:string[];workspace?:string}={users:[],profiles:[]};
 const evidence={stage:'SETUP',failureLine:0,ownerPath:'',ownerSignedIn:false,ownerCreated:false,ownerCapacity:false,ownerTracking:false,ownerTeam:false,
  staffSignedIn:false,staffJoined:false,staffCapacity:false,staffTracking:false,staffTeamDenied:false,
  privateFlag:false,exactMembers:false,cleanup:false};
 const record=()=>writeFileSync(info.outputPath('play-review-business.json'),JSON.stringify(evidence,null,2),{mode:0o600});
 let ownerContext:Awaited<ReturnType<typeof browser.newContext>>|undefined,staffContext:Awaited<ReturnType<typeof browser.newContext>>|undefined;
 let primaryFailure:unknown=null;
 async function makeReviewer(email:string,label:string){
  const userId=requireCreatedUserId(checked(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{loadgistic_review:true}}),'CREATE_REVIEW_USER'));
  created.users.push(userId);
  checked(await service.from('profiles').update({role:'DRIVER',active:true,full_name:label,first_name:label}).eq('id',userId),'REVIEW_PROFILE');
  const profileId=requireId(checked(await service.from('provider_profiles').insert({user_id:userId,business_name:label,
   handle:`review-${nonce}-${label.toLowerCase()}`,review_workspace:true,public_visibility:'PRIVATE'}).select('id').single(),'REVIEW_PROVIDER'),'REVIEW_PROVIDER');
  created.profiles.push(profileId);
  checked(await service.from('app_review_accounts').insert({user_id:userId,provider_profile_id:profileId,
   expected_role:'DRIVER',capacity_digest:Buffer.from(randomBytes(32)).toString('hex'),tracking_digest:Buffer.from(randomBytes(32)).toString('hex')}),'REVIEW_REGISTRATION');
  checked(await service.rpc('accept_content_policy',{actor_user_id:userId,policy_version:'2026-10-09'}),'REVIEW_POLICY');
  return userId;
 }
 async function signIn(page:import('playwright-core').Page,email:string){
  await page.goto('/review-access');
  await page.getByLabel('Review account email',{exact:true}).fill(email);
  await page.getByLabel('Review account password',{exact:true}).fill(password);
  const result=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/review-access'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const response=await result;expect(response.status()).toBe(200);
  const body=await response.json() as {accessToken?:string};
  expect(body.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('tab',{name:'My workspace',exact:true})).toBeVisible();
  return body.accessToken!;
 }
 async function businessRead(page:import('playwright-core').Page,token:string,path:string){
  const response=await page.request.get(`${directApi||preview}/api/business-workspaces/${created.workspace}${path}`,{headers:{Authorization:`Bearer ${token}`}});
  expect(response.status()).toBe(200);
 }
 async function connectContext(context:Awaited<ReturnType<typeof browser.newContext>>){
  if(!directApi)return;
  await context.route('**/api/**',async route=>{
   try{
    const url=new URL(route.request().url());
    const target=new URL(url.pathname+url.search,directApi);
    const headers={...route.request().headers(),origin:directApi};
    const response=await route.fetch({url:target.toString(),headers});
    await route.fulfill({response});
   }catch{
    // A pending fetch can outlive a navigation or a test failure; no credentials
    // from Playwright's request call log should be emitted by the route handler.
    await route.abort().catch(()=>undefined);
   }
  });
 }
 try{
  evidence.stage='CREATE_IDENTITIES';record();
  const ownerId=await makeReviewer(ownerEmail,'Owner'),staffId=await makeReviewer(staffEmail,'Staff');
  ownerContext=await browser.newContext({baseURL:preview,viewport:{width:390,height:844},isMobile:true,hasTouch:true,
   extraHTTPHeaders:{'x-forwarded-for':'127.0.0.231'}});
  await connectContext(ownerContext);
  evidence.stage='OWNER_LOGIN';record();
  const owner=await ownerContext.newPage(),ownerToken=await signIn(owner,ownerEmail);evidence.ownerSignedIn=true;
  evidence.stage='OWNER_CREATE';record();
  await owner.getByRole('tab',{name:'My workspace',exact:true}).click();
  await owner.getByRole('button',{name:'Switch workspace',exact:true}).click();
  await expect(owner.getByText('Your workspaces',{exact:true})).toBeVisible();
  await owner.getByRole('button',{name:/Business workspace/}).last().click();
  await owner.getByLabel('Business name',{exact:true}).fill(`Play review ${nonce}`);
  await owner.getByLabel('Business handle',{exact:true}).fill(`play-review-${nonce}`);
  const createdResponse=owner.waitForResponse(response=>new URL(response.url()).pathname==='/api/business-workspaces'&&response.request().method()==='POST');
  await owner.getByRole('button',{name:'Create workspace',exact:true}).click();
  expect((await createdResponse).status()).toBe(201);
  const [workspaceId,privateFlag]=localSql(`select id||'|'||review_workspace from public.business_workspaces where handle='play-review-${nonce}'`).split('|');
  expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/);
  created.workspace=workspaceId;evidence.ownerCreated=true;evidence.privateFlag=privateFlag==='true';
  await expect(owner).toHaveURL(/\/business-capacity$/,{timeout:30_000});
  expect(evidence.privateFlag).toBe(true);
  evidence.stage='OWNER_READS';record();
  await businessRead(owner,ownerToken,'/capacity/discovery');evidence.ownerCapacity=true;
  await businessRead(owner,ownerToken,'/tracking');evidence.ownerTracking=true;
  await owner.getByRole('tab',{name:'Account',exact:true}).click();
  await owner.getByRole('button',{name:'Team',exact:true}).click();
  await expect(owner.getByRole('button',{name:'Invite teammate',exact:true})).toBeVisible();evidence.ownerTeam=true;
  evidence.stage='OWNER_INVITE';record();
  await owner.getByRole('button',{name:'Invite teammate',exact:true}).click();
  await owner.getByLabel('Email',{exact:true}).fill(staffEmail);
  await owner.getByRole('button',{name:'Send invitation',exact:true}).click();
  await expect.poll(async()=>localSql(`select status from public.business_workspace_invitations where workspace_id='${workspaceId}' and email='${staffEmail}'`)).toBe('PENDING');

  staffContext=await browser.newContext({baseURL:preview,viewport:{width:390,height:844},isMobile:true,hasTouch:true,
   extraHTTPHeaders:{'x-forwarded-for':'127.0.0.232'}});
  await connectContext(staffContext);
  evidence.stage='STAFF_LOGIN';record();
  const staff=await staffContext.newPage(),staffToken=await signIn(staff,staffEmail);evidence.staffSignedIn=true;
  evidence.stage='STAFF_JOIN';record();
  await staff.getByRole('tab',{name:'My workspace',exact:true}).click();
  await staff.getByRole('button',{name:'Switch workspace',exact:true}).click();
  await expect(staff.getByText('You have been invited',{exact:true})).toBeVisible();
  await staff.getByRole('button',{name:'Join',exact:true}).click();
  await expect(staff).toHaveURL(/\/business-capacity$/,{timeout:30_000});evidence.staffJoined=true;
  evidence.stage='STAFF_READS';record();
  await businessRead(staff,staffToken,'/capacity/discovery');evidence.staffCapacity=true;
  await businessRead(staff,staffToken,'/tracking');evidence.staffTracking=true;
  await staff.getByRole('tab',{name:'Account',exact:true}).click();
  await expect(staff.getByRole('button',{name:'Team',exact:true})).toHaveCount(0);evidence.staffTeamDenied=true;
  const members=localSql(`select user_id||'|'||role||'|'||can_view_capacity||'|'||can_view_tracking from public.business_workspace_members where workspace_id='${workspaceId}' order by role`).split('\n');
  expect(members).toHaveLength(2);
  expect(members).toEqual(expect.arrayContaining([`${ownerId}|OWNER|true|true`,`${staffId}|STAFF|true|true`]));
  evidence.exactMembers=true;
 }catch(error){
  primaryFailure=error;
  evidence.failureLine=Number((error instanceof Error?error.stack||'':'').match(/play-review-business\.spec\.ts:(\d+):\d+/)?.[1]||0);
  const active=ownerContext?.pages()[0]?.url();evidence.ownerPath=active?new URL(active).pathname:'';
  record();throw error;
 }finally{
  record();
  await Promise.allSettled([ownerContext?.unrouteAll({behavior:'ignoreErrors'}),staffContext?.unrouteAll({behavior:'ignoreErrors'})]);
  await Promise.allSettled([ownerContext?.close(),staffContext?.close()]);
  try{
   localSql(`do $cleanup$ declare w uuid;begin select id into w from public.business_workspaces where handle='play-review-${nonce}' and review_workspace;
    if w is not null then
     delete from public.business_workspace_selections where workspace_id=w;
     delete from public.business_workspace_audit where workspace_id=w;
     delete from public.business_workspace_invitations where workspace_id=w;
     delete from public.business_workspace_members where workspace_id=w;
     delete from public.business_workspaces where id=w;
    end if;end $cleanup$;`);
   for(const id of created.users){checked(await service.from('app_review_accounts').delete().eq('user_id',id),'DELETE_REVIEW_ACCOUNT');}
   for(const id of created.profiles){checked(await service.from('provider_profiles').delete().eq('id',id),'DELETE_PROVIDER');}
   for(const id of created.users){checked(await service.from('audit_logs').delete().eq('actor_user_id',id),'DELETE_AUDIT');checked(await service.auth.admin.deleteUser(id),'DELETE_AUTH_USER');}
   evidence.cleanup=true;evidence.stage='COMPLETE';record();
  }catch(error){
   record();if(!primaryFailure)throw error;
  }
 }
});
