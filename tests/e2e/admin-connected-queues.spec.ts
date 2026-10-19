import {test,expect as baseExpect} from './browser-test';
import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {localAuditService,auditFleetProvider,checked} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {openCapacityFilters,chooseCapacityOptions} from './capacity-drawer-helper';
// These assertions wait for streamed authorized/denied pages. Dedicated
// performance gates retain their own bounds; the total case bound stays120s.
const expect=baseExpect.configure({timeout:20000});

async function failureEvidence(page:any,info:any,stage:string,error:unknown){
 const value=error instanceof Error?error.name:'OTHER',url=new URL(page.url());
 const evidence={stage,errorClass:['Error','TimeoutError','AssertionError','TypeError'].includes(value)?value:'OTHER',route:url.pathname.replace(/[a-f0-9-]{36}/gi,':id'),kind:['ORGANIZATION','PROVIDER_PROFILE'].includes(url.searchParams.get('kind')||'')?url.searchParams.get('kind'):null,recordCards:await page.locator('.admin-operation-record-card').count(),notFound:await page.getByRole('heading',{name:'404',exact:true}).count()};
 const file=info.outputPath('sanitized-failure-stage.json');mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(evidence,null,2)+'\n');
 if(evidence.recordCards===1)try{await page.locator('.admin-operation-record-card').screenshot({path:info.outputPath('synthetic-record-state.png'),animations:'disabled',timeout:5000});}catch{/* Capture cannot delay cleanup. */}
}

// Exact disposable local records; these checks never submit moderation or erasure.
test.use({trace:'off',screenshot:'off'});
async function identity(db:SupabaseClient,ids:string[],role:'ADMIN'|'SUPPORT'|'DRIVER',permissions:Record<string,boolean>={}){
 const email=`admin-queue-${randomUUID()}@example.test`;
 const id=checked(await db.auth.admin.createUser({email,email_confirm:true})).user.id;ids.push(id);
 checked(await db.from('profiles').update({role,active:true,full_name:`Synthetic ${role.toLowerCase()} reviewer`}).eq('id',id));
 if(role==='SUPPORT')checked(await db.from('support_agent_profiles').insert({user_id:id,active:true,available:false,can_manage_support:false,...permissions}));
 return id;
}
async function cleanIdentities(db:SupabaseClient,ids:string[]){
 for(const id of ids){
  checked(await db.from('audit_logs').delete().eq('actor_user_id',id));
  checked(await db.from('audit_logs').delete().eq('entity_id',id));
  checked(await db.auth.admin.deleteUser(id));
 }
}

test('Private capacity keeps invalid staff deep links denied until the filters are corrected',async({page},info)=>{
 test.setTimeout(120000);const db=localAuditService(),ids:string[]=[];let stage='SETUP';let logout:(()=>Promise<unknown>)|undefined;
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 try{
  const admin=await identity(db,ids,'ADMIN');logout=await localSupportLogin(page,admin);
  stage='INVALID_SSR';await page.goto('/admin/capacity-network?status=EMPTY&status=PARTIAL&q=Synthetic%20transporter');
  await expect(page.getByTestId('capacity-feed-state')).toHaveAttribute('role','alert');
  await expect(page.getByRole('button',{name:'Review filters',exact:true})).toBeVisible();
  expect((await page.request.get('/api/admin/capacity-network?status=EMPTY&status=PARTIAL')).status()).toBe(400);
  // The same URL stays denied after reload; hydration cannot broaden the map.
  await page.reload();await expect(page.getByTestId('capacity-feed-state')).toHaveAttribute('role','alert');
  stage='EXPLICIT_CORRECTION';await page.getByRole('button',{name:'Review filters',exact:true}).click();
  const dialog=page.locator('.capacity-filter-dialog');await expect(dialog).toBeVisible();
  await chooseCapacityOptions(dialog,'status',['EMPTY','PARTIAL']);
  await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();
  await expect(page).toHaveURL(url=>url.pathname==='/admin/capacity-network'&&url.searchParams.getAll('status').length===1&&url.searchParams.get('status')==='EMPTY,PARTIAL');
  await expect(page.locator('.public-feed-overlay.error')).toHaveCount(0);
  await expect(page.locator('.public-feed-overlay.loading')).not.toBeVisible({timeout:30000});
  stage='INDEPENDENT_SEARCH';const drawer=await openCapacityFilters(page);
  await expect(drawer.getByRole('searchbox',{name:'Search transporters',exact:true})).toHaveValue('Synthetic transporter');
  const response=await page.request.get('/api/admin/capacity-network?status=EMPTY%2CPARTIAL');expect(response.status()).toBe(200);
  await drawer.screenshot({path:info.outputPath('admin-capacity-filter-correction.png')});
  expect(errors).toEqual([]);
 }catch(error){await failureEvidence(page,info,stage,error);throw Error('ADMIN_CAPACITY_SSR_WORKFLOW_FAILED: '+stage);}
 finally{await logout?.();await cleanIdentities(db,ids);}
});

test('Driver Open owner reaches its exact fleet and retains delegated workspace denial',async({page},info)=>{
 test.setTimeout(120000);const db=localAuditService(),ids:string[]=[];let owner:Awaited<ReturnType<typeof auditFleetProvider>>|undefined,stage='SETUP';const logouts:Array<()=>Promise<unknown>>=[];
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 try{
  owner=await auditFleetProvider(db,'admin-owner-link');const driver=await identity(db,ids,'DRIVER'),admin=await identity(db,ids,'ADMIN');
  checked(await db.from('organization_members').insert({organization_id:owner.organization_id,user_id:driver,membership_role:'DRIVER'}));
  checked(await db.from('drivers').insert({organization_id:owner.organization_id,user_id:driver,name:'Synthetic assigned driver'}));
  stage='ADMIN_DRIVER';logouts.push(await localSupportLogin(page,admin));await page.goto(`/admin/operations/drivers/${driver}`);
  const details=page.locator('.admin-operation-record-card');await expect(details).toBeVisible();
  const ownerLink=details.getByRole('link',{name:'Open owner',exact:true});await expect(ownerLink).toHaveAttribute('href',`/admin/operations/workspaces/${owner.organization_id}?kind=ORGANIZATION`);
  await details.screenshot({path:info.outputPath('driver-owner-link.png')});await ownerLink.click();
  stage='EXACT_OWNER';await expect(page).toHaveURL(new RegExp(`/admin/operations/workspaces/${owner.organization_id}\\?kind=ORGANIZATION$`));await expect(details).toBeVisible();
  await expect(page.getByRole('heading',{name:`Audit fleet ${owner.suffix}`,exact:true})).toBeVisible();
  await expect(details).toContainText(`@admin-owner-link-${owner.suffix}`);await details.screenshot({path:info.outputPath('driver-exact-owner.png')});
  const operations=await identity(db,ids,'SUPPORT',{can_manage_operations:true});stage='DELEGATED_DRIVER';logouts.push(await localSupportLogin(page,operations));await page.goto(`/admin/operations/drivers/${driver}`);
  await expect(details).toBeVisible();await details.getByRole('link',{name:'Open owner',exact:true}).click();
  stage='WORKSPACE_DENIED';await expect(page).toHaveURL(/\/admin\/operations$/);await expect(page.getByRole('heading',{name:'Platform Records',exact:true})).toBeVisible();await expect(details).toHaveCount(0);
  expect(errors).toEqual([]);
 }catch(error){await failureEvidence(page,info,stage,error);throw Error('ADMIN_DRIVER_OWNER_WORKFLOW_FAILED: '+stage);}
 finally{
  for(const logout of logouts)await logout();await cleanIdentities(db,ids);
  if(owner){checked(await db.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await db.from('audit_logs').delete().eq('entity_id',owner.organization_id));checked(await db.auth.admin.deleteUser(owner.id));checked(await db.from('organizations').delete().eq('id',owner.organization_id));}
 }
});

test('Content and deletion overflow pages recover saved synthetic cases with unchanged controls',async({page},info)=>{
 test.setTimeout(120000);const db=localAuditService(),ids:string[]=[],reportId=randomUUID(),requestId=randomUUID();let owner:Awaited<ReturnType<typeof auditFleetProvider>>|undefined,stage='SETUP';const logouts:Array<()=>Promise<unknown>>=[];
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 try{
  owner=await auditFleetProvider(db,'admin-queue-page');const admin=await identity(db,ids,'ADMIN'),subject=await identity(db,ids,'DRIVER');
  checked(await db.from('content_reports').insert({id:reportId,organization_id:owner.organization_id,handle:`admin-queue-page-${owner.suffix}`,category:'PROFILE',detail:`Synthetic queue case ${reportId}`,reporter_digest:randomUUID().replaceAll('-','').repeat(2),created_at:'2099-01-01T00:00:00Z'}));
  checked(await db.from('account_deletion_requests').insert({id:requestId,subject_user_id:subject,requested_at:'1900-01-01T00:00:00Z',review_due_at:'1900-01-31T00:00:00Z'}));
  logouts.push(await localSupportLogin(page,admin));stage='CONTENT_OVERFLOW';await page.goto('/admin/reviews/content?page=99999');
  const report=page.locator('section').filter({has:page.getByText(`Synthetic queue case ${reportId}`,{exact:true})});await expect(report).toBeVisible();await report.getByRole('button',{name:'Review report',exact:true}).click();
  for(const name of ['Hide reported content','Dismiss report'])await expect(report.getByRole('button',{name,exact:true})).toBeVisible();
  await expect(page.getByText('No content reports yet.',{exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Previous',exact:true})).toHaveCount(0);await report.screenshot({path:info.outputPath('content-overflow-recovered.png')});
  stage='PRIVACY_OVERFLOW';await page.goto('/admin/privacy?page=99999');const request=page.locator(`section[data-request-id="${requestId}"]`);await expect(request).toBeVisible();
  await expect(request.getByRole('link',{name:'Review account',exact:true})).toHaveAttribute('href',`/admin/operations/users/${subject}`);
  await request.getByRole('button',{name:'Process deletion request',exact:true}).click();await expect(request.getByRole('checkbox')).toHaveAttribute('required','');await expect(request.getByLabel('Type DELETE to confirm')).toHaveAttribute('pattern','DELETE');await expect(request.getByRole('dialog',{name:'Process deletion request',exact:true}).getByRole('button',{name:'Process deletion request',exact:true})).toBeVisible();
  await expect(page.getByText('No deletion requests yet.',{exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Previous',exact:true})).toHaveCount(0);await request.screenshot({path:info.outputPath('privacy-overflow-recovered.png')});
  stage='INVALID_PAGE';await page.goto('/admin/privacy?page=1.5');await expect(request).toBeVisible();await page.goto('/admin/reviews/content?page=1.5');await expect(report).toBeVisible();
  const trust=await identity(db,ids,'SUPPORT',{can_manage_trust:true});stage='TRUST_SCOPE';logouts.push(await localSupportLogin(page,trust));await page.goto('/admin/reviews/content?page=99999');await expect(report).toBeVisible();
  await page.goto('/admin/privacy?page=99999');await expect(page).not.toHaveURL(/\/admin\/privacy/);await expect(page.locator(`section[data-request-id="${requestId}"]`)).toHaveCount(0);
  const operations=await identity(db,ids,'SUPPORT',{can_manage_operations:true});stage='CONTENT_DENIED';logouts.push(await localSupportLogin(page,operations));await page.goto('/admin/reviews/content?page=99999');await expect(page).not.toHaveURL(/\/admin\/reviews\/content/);await expect(page.locator(`form[action="/api/admin/content/${reportId}"]`)).toHaveCount(0);
  expect(checked(await db.from('content_reports').select('status').eq('id',reportId).single()).status).toBe('PENDING');expect(checked(await db.from('account_deletion_requests').select('status').eq('id',requestId).single()).status).toBe('REQUESTED');expect(errors).toEqual([]);
 }catch(error){await failureEvidence(page,info,stage,error);throw Error('ADMIN_QUEUE_PAGING_WORKFLOW_FAILED: '+stage);}
 finally{
  for(const logout of logouts)await logout();checked(await db.from('content_reports').delete().eq('id',reportId));checked(await db.from('account_deletion_requests').delete().eq('id',requestId));await cleanIdentities(db,ids);
  if(owner){checked(await db.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await db.auth.admin.deleteUser(owner.id));checked(await db.from('organizations').delete().eq('id',owner.organization_id));}
 }
});
