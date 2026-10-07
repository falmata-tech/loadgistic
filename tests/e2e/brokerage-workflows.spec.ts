import {test,expect} from '@playwright/test';
import type {Page,Browser,BrowserContext} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';

test('transport requests and retained guest records keep separate staff permissions and history',async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(240000);page.setDefaultTimeout(15000);
 const service=localAuditService(),suffix=randomUUID().slice(0,8),brokerEmail=`broker-${suffix}@example.test`,supportEmail=`help-${suffix}@example.test`,otherEmail=`broker-other-${suffix}@example.test`,guestEmail=`guest-${suffix}@example.test`;
 const ids:string[]=[],contexts:BrowserContext[]=[];let requestId='',chatId='';
 const admin=checked(await service.from('profiles').select('id').eq('active',true).eq('role','ADMIN').limit(1).single());
 async function context(){const c=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:page.viewportSize()!,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.241'}});contexts.push(c);return c;}
 async function verifiedSession(c:BrowserContext,id:string){const identity=checked(await service.auth.admin.getUserById(id)).user,link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email!}));const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),login=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();
  const cookies=createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url'));await c.addCookies(cookies.map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
 }
 async function staff(email:string,brokerage:boolean){const auth=checked(await service.auth.admin.createUser({email,email_confirm:true}));ids.push(auth.user.id);checked(await service.rpc('create_managed_support_agent',{actor_user_id:admin.id,agent_auth_user_id:auth.user.id,command:{name:`Workflow ${brokerage?'broker':'support'} ${suffix}`,email,can_manage_support:false,can_manage_brokerage:brokerage,max_open_conversations:20}}));return auth.user.id;}
 async function emailLogin(p:Page,email:string,destination:RegExp){await p.goto('/login');const since=Date.now();await p.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);await p.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(p.getByTestId('email-code-form')).toBeVisible();const code=await localMailpitNumericCode(email,since,['Your Loadgistic signup code','Your Loadgistic sign-in code']);await p.getByLabel('Six-digit code',{exact:true}).fill(code);await p.getByRole('button',{name:'Continue',exact:true}).click();await expect(p).toHaveURL(destination,{timeout:30000});}
 try{
  const ac=await context();await verifiedSession(ac,admin.id);const ap=await ac.newPage();ap.setDefaultTimeout(15000);
  // Provision a brokerage-only member through the actual admin form.
  await ap.goto('/admin/support');const create=ap.locator('form[action="/api/admin/support-agents"]');await ap.locator('details').filter({has:create}).locator('summary').click();
  await create.locator('[name=name]').fill(`Broker ${suffix}`);await create.locator('[name=email]').fill(brokerEmail);await create.locator('[name=canManageSupport]').uncheck();await create.locator('[name=canManageBrokerage]').check();
  await create.getByRole('button',{name:'Create member',exact:true}).scrollIntoViewIfNeeded();
  await ap.screenshot({path:info.outputPath('create-team-member.png'),fullPage:true});
  const createdResponse=ap.waitForResponse(r=>r.url().includes('/api/admin/support-agents')&&r.request().method()==='POST',{timeout:45000});
  await create.getByRole('button',{name:'Create member',exact:true}).click({noWaitAfter:true});const createdResult=await createdResponse;expect(createdResult.status()).toBe(303);await expect(ap).toHaveURL(/\/admin\/support\?success=/,{timeout:30000});
  const broker=checked(await service.from('profiles').select('id').eq('email',brokerEmail).single());ids.push(broker.id);
  const other=await staff(otherEmail,true),support=await staff(supportEmail,false);
  // Exact synthetic support fixture only, without rebalancing existing local queues.
  checked(await service.from('support_agent_profiles').update({can_manage_support:true,available:true}).eq('user_id',support));
  const bc=await context(),bp=await bc.newPage();bp.setDefaultTimeout(15000);await emailLogin(bp,brokerEmail,/\/brokerage$/);await expect(bp.getByRole('heading',{name:'Transport requests',exact:true})).toBeVisible();
  const revision=await bp.request.get('/api/brokerage/updates?queue=MINE&view=ALL');expect(revision.status()).toBe(200);const revisionBody=await revision.json();expect(revisionBody.revision).toBe(revision.headers().etag);expect((await bp.request.get('/api/brokerage/updates?queue=MINE&view=ALL',{headers:{'If-None-Match':revisionBody.revision}})).status()).toBe(304);
  await expect(bp.locator('.sidebar-nav').getByRole('link',{name:'Support',exact:true})).toHaveCount(0);
  await page.goto('/about');const entry=page.locator('.public-assistance-dock .public-assistance-request');await expect(entry).toHaveCount(1);await entry.click();const form=page.getByRole('form',{name:'Arrange transport',exact:true});
  await form.getByLabel('From',{exact:true}).fill(`Adama ${suffix}`);await form.getByLabel('To',{exact:true}).fill('Dire Dawa');await form.getByLabel('Name',{exact:true}).fill(`Caller ${suffix}`);await form.getByLabel('Phone',{exact:true}).fill('+251900000008');
  const submitted=page.waitForResponse(r=>r.url().endsWith('/api/transport-requests')&&r.request().method()==='POST');await form.getByRole('button',{name:'Start chat'}).click();const transportResponse=await submitted;expect(transportResponse.ok()).toBe(true);requestId=JSON.parse(transportResponse.request().postData()!).requestId;await expect(page.locator('.transport-conversation')).toContainText('Waiting for brokerage');
  requestId=checked(await service.from('transport_service_requests').select('id').eq('origin',`Adama ${suffix}`).single()).id;
  await bp.goto('/brokerage?queue=UNASSIGNED&view=ALL');let card=bp.locator(`[data-request-id="${requestId}"]`);await expect(card).toBeVisible();await expect(card.getByRole('link',{name:'+251900000008'})).toHaveCount(0);
  await card.getByRole('button',{name:'Claim request',exact:true}).click();await expect(card).toHaveCount(0);await bp.getByRole('link',{name:/^Mine/}).click();card=bp.locator(`[data-request-id="${requestId}"]`);await expect(card.getByRole('link',{name:'+251900000008'})).toBeVisible();
  await card.getByRole('combobox',{name:'Status',exact:true}).selectOption('CONTACTED');await card.getByLabel('Follow-up note').fill('Called and checking suitable transporters.');await card.getByRole('button',{name:'Save follow-up'}).click();await expect(card.getByRole('status')).toContainText('Follow-up saved');
  await expect.poll(async()=>checked(await service.from('transport_service_requests').select('status').eq('id',requestId).single()).status).toBe('CONTACTED');await card.getByText('Recent activity',{exact:true}).click();await expect(card.locator('.brokerage-activity')).toContainText('Called and checking');await bp.screenshot({path:info.outputPath('brokerage-follow-up.png'),fullPage:true});
  // Admin hands this request to another broker, revoking the previous owner's read/write access.
  await ap.goto('/brokerage?queue=ALL&view=ALL');const adminCard=ap.locator(`[data-request-id="${requestId}"]`);await adminCard.getByRole('combobox',{name:'Assigned to',exact:true}).selectOption(other);
  // A background refresh must not silently upgrade the version tied to an unsaved assignment.
  checked(await service.rpc('update_transport_service_request',{actor_user_id:admin.id,request_id:requestId,expected_version:3,next_status:'CONTACTED',note:'Concurrent call note'}));
  await expect(adminCard.locator('.transport-follow-up input[name=version]')).toHaveValue('4',{timeout:20000});
  await expect(adminCard.locator('.brokerage-assignment input[name=version]')).toHaveValue('3');
  await adminCard.getByRole('button',{name:'Save assignment'}).click();await expect(adminCard.getByRole('alert')).toContainText('Another team member');await expect(adminCard.getByRole('combobox',{name:'Assigned to',exact:true})).toHaveValue(other);
  await ap.reload();await adminCard.getByRole('combobox',{name:'Assigned to',exact:true}).selectOption(other);await adminCard.getByRole('button',{name:'Save assignment'}).click();await expect.poll(async()=>checked(await service.from('transport_service_requests').select('assigned_agent_user_id').eq('id',requestId).single()).assigned_agent_user_id).toBe(other);
  await bp.reload();await expect(bp.locator(`[data-request-id="${requestId}"]`)).toHaveCount(0);
  const denied=await bp.request.post(`/api/admin/transport-requests/${requestId}`,{form:{version:'4',status:'CLOSED',note:'Should not save'}});expect(denied.ok()).toBe(false);
  const oc=await context();await verifiedSession(oc,other);const op=await oc.newPage();await op.goto('/brokerage?queue=MINE&view=ALL');const otherCard=op.locator(`[data-request-id="${requestId}"]`);await otherCard.getByRole('combobox',{name:'Status',exact:true}).selectOption('CLOSED');await otherCard.getByLabel('Follow-up note').fill('Introduced caller to transporter offline.');await otherCard.getByRole('button',{name:'Save follow-up'}).click();await expect(otherCard.getByRole('status')).toContainText('Follow-up saved');
  // Preserve staff handling of historical guest records without accepting new guest requests.
  chatId=randomUUID();checked(await service.from('guest_support_conversations').insert({id:chatId,email:guestEmail,email_digest:randomUUID().replaceAll('-','').repeat(2),phone:'+251900000009',status:'OPEN',assigned_agent_user_id:support}));
  checked(await service.from('guest_support_messages').insert({conversation_id:chatId,sender_kind:'GUEST',body:'I need help with a dispute about an update.'}));
  const chat=checked(await service.from('guest_support_conversations').select('assigned_agent_user_id').eq('id',chatId).single());expect(chat.assigned_agent_user_id).toBeTruthy();expect(chat.assigned_agent_user_id).not.toBe(broker.id);expect(chat.assigned_agent_user_id).not.toBe(other);
  await ap.goto(`/support/assisted/${chatId}`);const assignment=ap.getByRole('form',{name:'Support assignment'});await assignment.getByRole('combobox',{name:'Assigned to',exact:true}).selectOption(support);await assignment.getByRole('button',{name:'Save assignment'}).click();await expect.poll(async()=>checked(await service.from('guest_support_conversations').select('assigned_agent_user_id').eq('id',chatId).single()).assigned_agent_user_id).toBe(support);
  const sc=await context(),sp=await sc.newPage();sp.setDefaultTimeout(15000);await emailLogin(sp,supportEmail,/\/support$/);await expect(sp.locator('.sidebar-nav:visible,.mobile-nav:visible').getByRole('link',{name:'Support',exact:true})).toBeVisible();await expect(sp.locator('.sidebar-nav').getByRole('link',{name:'Brokerage',exact:true})).toHaveCount(0);
  await sp.getByRole('link',{name:'Guest support',exact:true}).click();await sp.getByText(guestEmail,{exact:true}).click();await expect(sp.getByText('I need help with a dispute about an update.',{exact:true})).toBeVisible();
  await sp.getByLabel('Message',{exact:true}).fill('We have received your issue and are reviewing the details.');await sp.getByRole('button',{name:'Send',exact:true}).click();await expect(sp.getByText('We have received your issue and are reviewing the details.',{exact:true})).toBeVisible({timeout:15000});await sp.screenshot({path:info.outputPath('support-reply.png'),fullPage:true});
  const deniedQueue=await sp.request.post(`/api/admin/transport-requests/${requestId}`,{form:{version:'5',status:'NEW',note:'Should not save'}});expect(deniedQueue.status()).toBe(403);
  const privateChat=await bp.request.get(`/support/assisted/${chatId}`);const deniedHtml=await privateChat.text();expect(deniedHtml).not.toContain(guestEmail);expect(deniedHtml).not.toContain('I need help with a dispute about an update.');
  // Next can stream its not-found UI with HTTP 200; verify the protected API and rendered denial.
  expect((await bp.request.get(`/api/support/updates?kind=GUEST&conversation=${chatId}`)).status()).toBe(403);await bp.goto(`/support/assisted/${chatId}`);await expect(bp.getByRole('heading',{name:'404',exact:true})).toBeVisible();await expect(bp.locator('.guest-support-thread')).toHaveCount(0);
  await sp.getByRole('button',{name:'Close conversation',exact:true}).click();await expect.poll(async()=>checked(await service.from('guest_support_conversations').select('status').eq('id',chatId).single()).status).toBe('CLOSED');
  expect((await service.from('transport_service_requests').select('id',{count:'exact',head:true}).eq('requester_name',`Caller ${suffix}`)).count).toBe(1);
 }finally{
  for(const c of contexts)await c.close();
  if(chatId){await service.from('access_email_deliveries').delete().eq('entity_id',chatId);await service.from('guest_support_conversations').delete().eq('id',chatId);}
  if(requestId){checked(await service.from('transport_chat_messages').delete().eq('request_id',requestId));checked(await service.from('transport_chat_access').delete().eq('request_id',requestId));await service.from('transport_request_events').delete().eq('request_id',requestId);await service.from('transport_service_requests').delete().eq('id',requestId);await service.from('audit_logs').delete().eq('entity_id',requestId);}
  // Only these synthetic identities are removed; preserve all fixture/demo accounts.
  const found=await service.from('profiles').select('id').in('email',[brokerEmail,supportEmail,otherEmail]);
  for(const id of new Set([...ids,...(found.data||[]).map((r:{id:string})=>r.id)])){await service.from('audit_logs').delete().eq('actor_user_id',id);await service.from('audit_logs').delete().eq('entity_id',id);checked(await service.auth.admin.deleteUser(id));}
 }
});

test('two brokerage claims have one winner and staff permission removal requeues open work',async()=>{
 const service=localAuditService(),ids:string[]=[];let requestId='';const suffix=randomUUID().slice(0,8);
 try{
  for(let i=0;i<2;i++){const created=checked(await service.auth.admin.createUser({email:`race-${suffix}-${i}@example.test`,email_confirm:true}));const id=created.user.id;ids.push(id);checked(await service.from('profiles').update({role:'SUPPORT',active:true,full_name:`Race broker ${i}`}).eq('id',id));checked(await service.from('support_agent_profiles').insert({user_id:id,active:true,available:false,max_open_conversations:3,can_manage_support:false,can_manage_brokerage:true}));}
  requestId=randomUUID();checked(await service.rpc('create_transport_service_request',{request_id:requestId,command:{name:'Race test',phone:'+251900000011',origin:'Adama',destination:'Dire Dawa'}}));
  const results=await Promise.all(ids.map(id=>service.rpc('assign_transport_service_request',{actor_user_id:id,request_id:requestId,expected_version:1,target_user_id:null,claim:true})));
  expect(results.filter(r=>!r.error)).toHaveLength(1);expect(results.filter(r=>r.error?.message==='TRANSPORT_REQUEST_CHANGED')).toHaveLength(1);
  const request=checked(await service.from('transport_service_requests').select('assigned_agent_user_id,version').eq('id',requestId).single());expect(request.version).toBe(2);
  const admin=checked(await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
  checked(await service.rpc('update_managed_support_agent',{actor_user_id:admin.id,agent_user_id:request.assigned_agent_user_id,command:{active:true,available:false,max_open_conversations:3,can_manage_support:false,can_manage_brokerage:false}}));
  const released=checked(await service.from('transport_service_requests').select('assigned_agent_user_id,version').eq('id',requestId).single());expect(released).toEqual({assigned_agent_user_id:null,version:3});
  const denied=await service.rpc('brokerage_request_inbox',{actor_user_id:request.assigned_agent_user_id,requested_queue:'MINE',requested_view:'ALL',requested_page:1});expect(denied.error?.message).toBe('FORBIDDEN');
 }finally{
  if(requestId){checked(await service.from('transport_chat_messages').delete().eq('request_id',requestId));checked(await service.from('transport_chat_access').delete().eq('request_id',requestId));checked(await service.from('transport_request_events').delete().eq('request_id',requestId));checked(await service.from('transport_service_requests').delete().eq('id',requestId));checked(await service.from('audit_logs').delete().eq('entity_id',requestId));}
  for(const id of ids){checked(await service.from('audit_logs').delete().eq('actor_user_id',id));checked(await service.from('audit_logs').delete().eq('entity_id',id));checked(await service.auth.admin.deleteUser(id));}
 }
});

test('team queues keep the active section clear and long guest identities within the phone header',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(60000);const service=localAuditService(),suffix=randomUUID().slice(0,8);let userId='',chatId='';const fifoIds=[randomUUID(),randomUUID()];let client:ReturnType<typeof createClient>|undefined;
 try{
  const auth=checked(await service.auth.admin.createUser({email:`layout-broker-${suffix}@example.test`,email_confirm:true}));userId=auth.user.id;
  checked(await service.from('profiles').update({role:'SUPPORT',active:true,full_name:'Layout broker'}).eq('id',userId));
  checked(await service.from('support_agent_profiles').insert({user_id:userId,active:true,available:true,max_open_conversations:3,can_manage_support:false,can_manage_brokerage:true}));
  const link=checked(await service.auth.admin.generateLink({type:'magiclink',email:auth.user.email!})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();
  await page.context().addCookies(createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url')).map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
  await page.goto('/brokerage');await expect(page.getByRole('navigation',{name:'Brokerage queues'}).getByRole('link',{name:/Mine/})).toHaveClass('active');
  await expect(page.locator('.workspace-title .meta')).toHaveText('Brokerage');
  await expect(page.getByRole('navigation',{name:'Transport request status'}).getByRole('link',{name:/Active chats/})).toHaveClass('active');
  await page.screenshot({path:info.outputPath('brokerage-navigation.png'),fullPage:true});
  checked(await service.from('support_agent_profiles').update({can_manage_support:true}).eq('user_id',userId));chatId=randomUUID();
  checked(await service.from('guest_support_conversations').insert({id:chatId,email:`guest-with-a-long-address-${suffix}@example.test`,email_digest:'e'.repeat(64),phone:'+251900000012',status:'OPEN',assigned_agent_user_id:userId}));
  await page.goto(`/support/assisted/${chatId}`);const heading=page.locator('.support-thread-header'),status=heading.locator('.status');await expect(status).toBeVisible();
  const bounds=await heading.boundingBox(),pill=await status.boundingBox();expect(bounds).toBeTruthy();expect(pill).toBeTruthy();expect(pill!.x+pill!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width);expect(pill!.x).toBeGreaterThanOrEqual(bounds!.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('support-header.png'),fullPage:true});
  checked(await service.from('guest_support_conversations').insert(fifoIds.map((id,index)=>({id,email:`fifo-${index}-${suffix}@example.test`,email_digest:(index?'a':'b').repeat(64),phone:'+251900000017',status:'WAITING',created_at:`1900-01-0${index+1}T00:00:00Z`}))));
  await page.goto('/support/assisted?view=WAITING');const oldest=page.locator(`form[action="/api/guest-support/${fifoIds[0]}/claim"]`);
  await expect(oldest.getByRole('button',{name:'Claim',exact:true})).toBeVisible();await expect(page.locator(`form[action="/api/guest-support/${fifoIds[1]}/claim"]`)).toHaveCount(0);
  await page.screenshot({path:info.outputPath('support-waiting.png'),fullPage:true});
  await oldest.getByRole('button',{name:'Claim',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/support/assisted/${fifoIds[0]}`),{timeout:15000});
  expect(checked(await service.from('guest_support_conversations').select('assigned_agent_user_id,status').eq('id',fifoIds[0]).single())).toEqual({assigned_agent_user_id:userId,status:'OPEN'});

 }finally{if(client)await client.auth.signOut({scope:'local'});checked(await service.from('guest_support_conversations').delete().in('id',fifoIds));if(chatId)checked(await service.from('guest_support_conversations').delete().eq('id',chatId));if(userId)checked(await service.auth.admin.deleteUser(userId));}
});
