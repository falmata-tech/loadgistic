import {test,expect} from './browser-test';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test.use({trace:'off',video:'off',screenshot:'off',actionTimeout:10000,navigationTimeout:30000});
function checked<T=unknown>(result:{data:unknown;error:unknown}):T{
 if(result.error)throw Error('LOCAL_CLAIM_FIXTURE_FAILED');return result.data as T;
}
type SavedChat={status:string;assigned_agent_user_id:string|null};

test('member Waiting offers only the authoritative FIFO claim and repeats current authority on submit',async({page},info)=>{
 test.setTimeout(180000);
 const db=localAuditService(),authIds:string[]=[],memberChats:string[]=[],guestChats:string[]=[];
 const marker=randomUUID();let staffId='',logout:undefined|(()=>Promise<unknown>),stage='EMPTY_QUEUE_PREFLIGHT';
 const diagnostics={stage:'',failureClass:'',authIds,memberChats,guestChats,cleanupFailure:'',cleanupVerified:false,reads:[] as {stage:string;status:number;rejected:boolean}[]};
 async function identity(role:'SUPPORT'|'DRIVER',index:number){
  const created=await db.auth.admin.createUser({email:`claim144-${marker}-${role.toLowerCase()}-${index}@example.test`,email_confirm:true,
   user_metadata:{full_name:role==='SUPPORT'?'Synthetic claim Support':`Synthetic claim member ${String(index).padStart(2,'0')}`},
   app_metadata:{fixture_source:'loadgistic',audit_case:'support-waiting-claim-144'}});
  if(created.error||!created.data.user)throw Error('LOCAL_CLAIM_IDENTITY_FAILED');
  const id=created.data.user.id;authIds.push(id);checked(await db.from('profiles').update({active:true,role}).eq('id',id));return id;
 }
 async function waiting(expectedRows:number){
  const response=await page.goto('/support?view=WAITING',{waitUntil:'domcontentloaded'});
  expect(response?.status()).toBe(200);await expect(page.getByRole('heading',{name:'Provider support',exact:true})).toBeVisible({timeout:10000});
  await expect(page.locator('.support-conversation-list > article')).toHaveCount(expectedRows,{timeout:10000});
 }
 const forms=()=>page.locator('form[action^="/api/support/conversations/"][action$="/claim"]');
 async function ownWaitingOnly(){
  const result=await db.from('support_conversations').select('id').eq('status','WAITING').limit(17);
  const rows=checked<{id:string}[]>(result);expect(rows.length).toBeLessThanOrEqual(16);
  expect(rows.every(row=>memberChats.includes(row.id))).toBe(true);
 }
 async function rejectedClaim(id:string){
  await ownWaitingOnly();const response=await page.request.post(`/api/support/conversations/${id}/claim`,{headers:{Origin:'http://127.0.0.1:3100'},maxRedirects:0,timeout:15000});
  const destination=new URL(response.headers().location||'/', 'http://127.0.0.1:3100');
  const rejected=response.status()===303&&destination.pathname==='/support'&&destination.searchParams.get('view')==='WAITING'&&Boolean(destination.searchParams.get('error'));
  diagnostics.reads.push({stage,status:response.status(),rejected});expect(rejected).toBe(true);
  expect(checked<SavedChat>(await db.from('support_conversations').select('status,assigned_agent_user_id').eq('id',id).single())).toEqual({status:'WAITING',assigned_agent_user_id:null});
  expect(checked<unknown[]>(await db.from('support_events').select('id').eq('conversation_id',id).eq('event_type','CLAIMED'))).toHaveLength(0);
  expect(checked<unknown[]>(await db.from('audit_logs').select('id').eq('entity_id',id).eq('action','SUPPORT_CONVERSATION_CLAIMED'))).toHaveLength(0);
 }
 try{
  // A global FIFO command is exercised only when all Waiting work belongs to
  // this test. Existing workers, assignments and availability remain untouched.
  for(const table of ['support_conversations','guest_support_conversations']){
   const result=await db.from(table).select('id',{count:'exact',head:true}).eq('status','WAITING');
   if(result.error)throw Error('LOCAL_EMPTY_QUEUE_PREFLIGHT_FAILED');expect(result.count).toBe(0);
  }
  stage='SYNTHETIC_FIXTURES';staffId=await identity('SUPPORT',0);
  checked(await db.from('support_agent_profiles').insert({user_id:staffId,active:true,available:false,max_open_conversations:2,can_manage_support:true,can_manage_brokerage:false}));
  const members:string[]=[];for(let i=1;i<=17;i++)members.push(await identity('DRIVER',i));
  const tie=[randomUUID(),randomUUID()].sort(),ids=[...tie,...Array.from({length:14},()=>randomUUID())];
  const createdAt=Date.now()-120000;
  checked(await db.from('support_conversations').insert(ids.map((id,index)=>({id,customer_user_id:members[index],category:'ACCOUNT',status:'WAITING',
   created_at:new Date(createdAt+(index<2?0:index*1000)).toISOString(),last_message_at:new Date(createdAt+(index===1?60000:0)).toISOString()}))));memberChats.push(...ids);
  const memberOpen=randomUUID(),guestOpen=randomUUID();
  checked(await db.from('support_conversations').insert({id:memberOpen,customer_user_id:members[16],assigned_agent_user_id:staffId,category:'ACCOUNT',status:'OPEN'}));memberChats.push(memberOpen);
  checked(await db.from('guest_support_conversations').insert({id:guestOpen,email:`claim144-${marker}@example.test`,email_digest:marker.replaceAll('-','').repeat(2),phone:'+251900000144',status:'OPEN',assigned_agent_user_id:staffId}));guestChats.push(guestOpen);
  stage='STAFF_SESSION';logout=await localSupportLogin(page,staffId);
  stage='PAUSED_WAITING';await waiting(15);await expect(page.getByRole('button',{name:'Go available',exact:true})).toBeVisible();await expect(forms()).toHaveCount(0);
  await page.screenshot({path:info.outputPath('waiting-paused.png')});
  stage='SHARED_CAPACITY_FULL';checked(await db.from('support_agent_profiles').update({available:true}).eq('user_id',staffId));
  await waiting(15);await expect(page.locator('.support-agent-strip')).toContainText('2 of 2 assigned');await expect(forms()).toHaveCount(0);
  await page.screenshot({path:info.outputPath('waiting-shared-capacity-full.png')});
  // Direct fixture closure cannot run the automatic assignment command.
  checked(await db.from('support_conversations').update({status:'CLOSED'}).eq('id',memberOpen));
  checked(await db.from('guest_support_conversations').update({status:'CLOSED'}).eq('id',guestOpen));
  stage='FIFO_TIE_AND_LATER_PAGE';await waiting(15);await expect(forms()).toHaveCount(1);
  await expect(forms()).toHaveAttribute('action',`/api/support/conversations/${ids[0]}/claim`);
  const articles=page.locator('.support-conversation-list > article');
  await expect(articles.nth(0)).toContainText('Synthetic claim member 01');await expect(articles.nth(1)).toContainText('Synthetic claim member 02');
  await page.screenshot({path:info.outputPath('waiting-oldest-eligible.png')});
  await page.locator('.pagination').getByRole('link',{name:'Next page',exact:true}).click();
  await expect(page).toHaveURL(/\/support\?view=WAITING&page=2$/,{timeout:10000});
  await expect(articles).toHaveCount(1,{timeout:10000});await expect(articles.first()).toContainText('Synthetic claim member 16');await expect(forms()).toHaveCount(0);
  await page.screenshot({path:info.outputPath('waiting-later-page.png')});
  stage='FORGED_LATER_DENIAL';await rejectedClaim(ids[1]);
  stage='VISIBLE_FIRST_CLAIM';await waiting(15);await ownWaitingOnly();
  const claimed=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/support/conversations/${ids[0]}/claim`&&response.request().method()==='POST',{timeout:15000});
  await forms().getByRole('button',{name:'Claim',exact:true}).click();expect((await claimed).status()).toBe(303);
  await expect(page).toHaveURL(new RegExp(`/support/${ids[0]}(?:\\?|$)`),{timeout:10000});
  await expect(page.getByRole('heading',{name:'Synthetic claim member 01',exact:true})).toBeVisible({timeout:10000});
  expect(checked<SavedChat>(await db.from('support_conversations').select('status,assigned_agent_user_id').eq('id',ids[0]).single())).toEqual({status:'OPEN',assigned_agent_user_id:staffId});
  expect(checked<unknown[]>(await db.from('support_events').select('id').eq('conversation_id',ids[0]).eq('event_type','CLAIMED'))).toHaveLength(1);
  expect(checked<unknown[]>(await db.from('audit_logs').select('id').eq('entity_id',ids[0]).eq('action','SUPPORT_CONVERSATION_CLAIMED'))).toHaveLength(1);
  stage='ONLY_NEXT_ELIGIBLE';await waiting(15);await expect(forms()).toHaveCount(1);await expect(forms()).toHaveAttribute('action',`/api/support/conversations/${ids[1]}/claim`);
  await page.screenshot({path:info.outputPath('waiting-next-after-saved-claim.png')});
  stage='AUTHORITY_CHANGED_AFTER_READ';checked(await db.from('support_agent_profiles').update({can_manage_support:false}).eq('user_id',staffId));
  await rejectedClaim(ids[1]);
  expect(checked<SavedChat>(await db.from('support_conversations').select('status,assigned_agent_user_id').eq('id',ids[0]).single())).toEqual({status:'OPEN',assigned_agent_user_id:staffId});
  checked(await db.from('support_agent_profiles').update({can_manage_support:true}).eq('user_id',staffId));
  await waiting(15);await expect(forms()).toHaveCount(1);await expect(forms()).toHaveAttribute('action',`/api/support/conversations/${ids[1]}/claim`);
  stage='COMPLETE';
 }catch(error){
  diagnostics.stage=stage;const name=error instanceof Error?error.name:'';diagnostics.failureClass=['Error','TimeoutError','AssertionError','TypeError'].includes(name)?name:'OTHER';
  throw Error('SUPPORT_WAITING_CLAIM_FAILED: '+stage);
 }finally{
  let cleanupStage='SESSION';
  try{
   try{const result=await logout?.();if(result&&typeof result==='object'&&'error' in result&&result.error)diagnostics.cleanupFailure='SESSION';}catch{diagnostics.cleanupFailure='SESSION';}
   cleanupStage='MEMBER_CHATS';if(memberChats.length)checked(await db.from('support_conversations').delete().in('id',memberChats));
   cleanupStage='GUEST_CHATS';if(guestChats.length)checked(await db.from('guest_support_conversations').delete().in('id',guestChats));
   cleanupStage='EXACT_AUDITS';if(authIds.length)checked(await db.from('audit_logs').delete().in('actor_user_id',authIds));
   const entities=[...authIds,...memberChats,...guestChats];if(entities.length)checked(await db.from('audit_logs').delete().in('entity_id',entities));
   cleanupStage='EXACT_AUTH';for(const id of authIds)checked(await db.auth.admin.deleteUser(id));
   cleanupStage='VERIFY_ABSENCE';if(authIds.length){const remaining=await db.from('profiles').select('id',{count:'exact',head:true}).in('id',authIds);if(remaining.error||remaining.count!==0)throw Error('LOCAL_FIXTURE_REMAINS');}
   if(memberChats.length){const remaining=await db.from('support_conversations').select('id',{count:'exact',head:true}).in('id',memberChats);if(remaining.error||remaining.count!==0)throw Error('LOCAL_FIXTURE_REMAINS');}
   if(guestChats.length){const remaining=await db.from('guest_support_conversations').select('id',{count:'exact',head:true}).in('id',guestChats);if(remaining.error||remaining.count!==0)throw Error('LOCAL_FIXTURE_REMAINS');}
   diagnostics.cleanupVerified=true;
  }catch{diagnostics.cleanupFailure=cleanupStage;}
  diagnostics.stage=diagnostics.stage||stage;const file=info.outputPath('claim-diagnostics.json');mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(diagnostics,null,2)+'\n');
  if(diagnostics.cleanupFailure)throw Error('Support claim exact fixture cleanup failed at '+diagnostics.cleanupFailure+'.');
 }
});
