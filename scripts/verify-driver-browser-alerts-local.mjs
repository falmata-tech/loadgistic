import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {chromium} from 'playwright';
import {expect as baseExpect} from '@playwright/test';
import {localMailpitNumericCode} from '../tests/e2e/mailpit-helper.ts';
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env),'Loadgistic local services required');
const key=name=>env.match(new RegExp('^'+name+'=(.+)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const db=createClient('http://127.0.0.1:55321',key('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const anon=key('NEXT_PUBLIC_SUPABASE_ANON_KEY')||key('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),suffix=randomUUID().slice(0,8),web='http://127.0.0.1:3100',mobile='http://localhost:8084';
const onlyHandover=process.argv.includes('--handover-only');
const browser=await chromium.launch({headless:true,channel:'chromium'}),expect=baseExpect.configure({timeout:30000}),contexts=[],clients=[],users=[],files=[],errors=[];
let stage='setup',currentPage,shipmentId,vehicleId,providerId,chatId;
const checked=result=>{if(result.error)throw Error('LOCAL_FIXTURE_OPERATION_FAILED');return result.data;};
const rpc=async(name,args)=>checked(await db.rpc(name,args));
async function identity(label){const email=`alert-audit-${label}-${suffix}@example.test`,user=checked(await db.auth.admin.createUser({email,email_confirm:true})).user;users.push(user.id);return {...user,email};}
async function login(user){const generated=checked(await db.auth.admin.generateLink({type:'magiclink',email:user.email})),client=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);return checked(await client.auth.verifyOtp({type:'magiclink',token_hash:generated.properties.hashed_token})).session;}
async function context(){const value=await browser.newContext({viewport:{width:412,height:915},permissions:['notifications'],extraHTTPHeaders:{'x-forwarded-for':'127.0.0.248'}});contexts.push(value);return value;}
async function webPage(user){const c=await context(),session=await login(user);await c.addCookies(createChunks('sb-127-auth-token','base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')).map(cookie=>({...cookie,url:web,sameSite:'Lax'})));const page=await c.newPage();page.on('pageerror',error=>errors.push(error.name));return page;}
async function notifications(page){return page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration('/_loadgistic-alerts/');return (await registration?.getNotifications()||[]).map(item=>({body:item.body,href:item.data?.href,tag:item.tag}));});}
async function enable(page){await page.getByRole('button',{name:/^Updates/}).click();await page.getByRole('button',{name:'Enable browser alerts',exact:true}).click();await expect(page.getByRole('button',{name:'Browser alerts on',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();}
async function shot(page,name){await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:new URL('.local/'+name+'.png',root).pathname,fullPage:true});}
try{
 const driver=await identity('driver'),agent=await identity('support');checked(await db.from('profiles').update({active:true,role:'DRIVER',full_name:'Synthetic notification driver'}).eq('id',driver.id));
 providerId=randomUUID();checked(await db.from('provider_profiles').insert({id:providerId,user_id:driver.id,business_name:'Synthetic notification transporter',handle:'alert-'+suffix,public_visibility:'PRIVATE'}));
 const admin=checked(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single()).id;
 await rpc('create_managed_support_agent',{actor_user_id:admin,agent_auth_user_id:agent.id,command:{name:'Synthetic alert Support worker',email:agent.email,can_manage_support:true,can_manage_brokerage:false,available:false,max_open_conversations:20}});
 vehicleId=(await rpc('create_provider_vehicle',{actor_user_id:driver.id,command:{make:'Toyota',model:'Alert audit',plate:'ALERT-'+suffix,cargo_configuration:'Pickup truck',use_basis:'OWNED'}})).id;
 stage='driver and staff browser permission';const dw=await webPage(driver),sp=await webPage(agent);currentPage=dw;await dw.goto(web+'/about',{timeout:90000});await enable(dw);await sp.goto(web+'/support',{timeout:90000});await enable(sp);
 if(!onlyHandover){
 stage='staff new waiting notification';
 const created=await dw.request.post(web+'/api/support/conversations',{form:{category:'ACCOUNT',body:'Synthetic notification intake'},maxRedirects:0});assert.equal(created.status(),303);chatId=new URL(created.headers().location,web).searchParams.get('conversation');assert.match(chatId,/^[0-9a-f-]{36}$/);
 checked(await db.from('support_conversations').update({status:'WAITING',assigned_agent_user_id:null,created_at:'1900-01-01T00:00:00Z'}).eq('id',chatId));
 stage='stored waiting browser notification';currentPage=sp;await expect.poll(async()=>(await notifications(sp)).some(item=>item.body==='New support chat waiting'),{timeout:30000}).toBe(true);
 console.log('PASS: actual stored waiting notification');stage='staff claims fixture chat';await sp.goto(web+'/support?view=WAITING');sp.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/claim'))console.log('CHECK: claim request '+JSON.stringify({method:r.method(),navigation:r.isNavigationRequest(),resource:r.resourceType()}));});sp.on('requestfailed',r=>{if(new URL(r.url()).pathname.endsWith('/claim'))console.log('CHECK: claim failure '+JSON.stringify({reason:r.failure()?.errorText}));});sp.on('response',r=>{if(new URL(r.url()).pathname.endsWith('/claim'))console.log('CHECK: claim response '+JSON.stringify({status:r.status(),redirectPath:r.headers().location?new URL(r.headers().location,web).pathname.replace(/[0-9a-f-]{36}/g,'[fixture]'):null}));});await sp.evaluate(()=>{window.__alertAuditSubmit={count:0,prevented:false};document.addEventListener('submit',event=>{window.__alertAuditSubmit.count++;queueMicrotask(()=>window.__alertAuditSubmit.prevented=event.defaultPrevented);},true);});const claim=sp.locator('form[action="/api/support/conversations/'+chatId+'/claim"]');console.log('CHECK: exact fixture claim controls '+await claim.count());if(process.argv.includes('--slow-claim'))await sp.route('**/api/support/conversations/'+chatId+'/claim',async route=>{await new Promise(resolve=>setTimeout(resolve,7000));await route.continue();});await claim.getByRole('button',{name:'Claim',exact:true}).click();await expect(sp).toHaveURL(new RegExp('/support/'+chatId));
 console.log('PASS: real staff claim control and saved redirect');stage='assigned driver browser notification';currentPage=dw;await expect.poll(async()=>(await notifications(dw)).some(item=>item.body==='A team member is assigned'||item.body==='A team member joined your chat'),{timeout:30000}).toBe(true);
 stage='staff initial snapshot ready';await sp.getByRole('button',{name:/^Updates/}).click();await expect(sp.locator('.chat-alert-dialog a[href="/support/'+chatId+'"]')).toBeVisible();await expect(sp.getByRole('button',{name:'Browser alerts on',exact:true})).toBeVisible();await sp.getByRole('button',{name:'Close',exact:true}).click();stage='staff hidden-tab reply notification';
 console.log('CHECK: staff delivery state '+JSON.stringify(await sp.evaluate(()=>({origin:location.origin,path:location.pathname,permission:Notification.permission,prefs:Object.keys(localStorage).filter(key=>key.startsWith('loadgistic-alert:')&&!key.endsWith(':sent')).map(key=>localStorage.getItem(key)),controlled:!!navigator.serviceWorker.controller}))));
 // Chromium headless keeps tabs visible: inject visibility only, while retaining
 // actual saved messages, browser permission, worker and notifications.
 await sp.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 const sent=await dw.request.post(web+'/api/support/conversations/'+chatId+'/messages',{form:{body:'Synthetic unread driver reply'},maxRedirects:0});assert.equal(sent.status(),303);console.log('CHECK: saved customer messages '+checked(await db.from('support_messages').select('id').eq('conversation_id',chatId).eq('sender_user_id',driver.id)).length);
 await expect.poll(async()=>(await notifications(sp)).some(item=>item.body==='New unread message'),{timeout:30000}).toBe(true);
 const messages=checked(await db.from('support_messages').select('sequence').eq('conversation_id',chatId).eq('sender_user_id',driver.id));
 const read=await rpc('chat_read_state',{chat_kind:'SUPPORT',target_id:chatId,actor_user_id:agent.id});assert.ok(read.teamSeen<Math.max(...messages.map(item=>item.sequence)),'Hidden delivery must not acknowledge messages');
 const count=(await notifications(sp)).length;await new Promise(resolve=>setTimeout(resolve,6500));assert.equal((await notifications(sp)).length,count,'Poll replay must not duplicate notifications');
 await sp.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
 console.log('PASS: actual browser permission/worker waiting, assignment/join and unread delivery; visibility-only injection proves hidden polling without Seen; replay deduplicated');

 }
 if(!process.argv.includes('--staff-only')){
 const mc=await context(),session=await login(driver),mp=await mc.newPage();const warmed=await fetch(web+'/api/mobile/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:session.refresh_token}),signal:AbortSignal.timeout(55000)});assert.equal(warmed.status,200);const mobileSession=await warmed.json();assert.equal(mobileSession.state,'ACTIVE');mp.on('pageerror',error=>errors.push(error.name));await mc.addInitScript(token=>{if(!sessionStorage.getItem('alert-fixture-seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('alert-fixture-seeded','1');}},mobileSession.refreshToken);
 stage='Expo restore and Support page';await mp.goto(mobile+'/support',{timeout:90000});currentPage=mp;await expect(mp.getByRole('button',{name:'Refresh Support',exact:true})).toBeVisible();
 stage='real handover fixture';
 const route=checked(await db.from('capacities').select('current_route_points_json').eq('availability_geometry','ROUTE').limit(1).single()).current_route_points_json;
 const ownerEmail='approval-owner-'+suffix+'@example.test';
 const createdShipment=await dw.request.post(web+'/api/provider-shipments',{form:{vehicleId,origin:'Synthetic pickup',originPlaceRef:route[0].place_ref,destination:'Synthetic delivery',destinationPlaceRef:route[1].place_ref,cargoSummary:'Synthetic notification load',customerEmail:ownerEmail,expectedDeliveryDate:new Date(Date.now()+172800000).toISOString().slice(0,10),trackingMode:'STATUS_ONLY'}});assert.equal(createdShipment.status(),201);shipmentId=(await createdShipment.json()).id;assert.match(shipmentId,/^[0-9a-f-]{36}$/);
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
 for(const status of ['LOADING','IN_TRANSIT','UNLOADING']){const command={next_status:status};if(status!=='IN_TRANSIT'){const path='alert-audit/'+shipmentId+'/'+status+'.png';files.push(path);checked(await db.storage.from('shipment-proof').upload(path,pixel,{contentType:'image/png'}));command.proof={path:'supabase://shipment-proof/'+path,original_name:status+'.png',mime_type:'image/png'};}await rpc('update_provider_tracking_status',{actor_user_id:driver.id,target_shipment_id:shipmentId,command});}
 await expect.poll(async()=>await dw.request.get(web+'/api/notifications/handover').then(async r=>(await r.json()).items.length)).toBe(0);
 stage='shipment owner real email verification and approval';
 const oc=await context(),op=await oc.newPage();currentPage=op;await op.goto(web+'/track',{timeout:90000});await op.getByLabel('Email',{exact:true}).fill(ownerEmail);const requestedAt=Date.now();await op.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(op.getByLabel('6-digit email code',{exact:true})).toBeVisible();
 const code=await localMailpitNumericCode(ownerEmail,requestedAt,['Your Loadgistic tracking sign-in code']);await op.getByLabel('6-digit email code',{exact:true}).fill(code);await op.getByRole('button',{name:'Open tracking',exact:true}).click();await expect(op.getByRole('button',{name:'Approve unloading',exact:true})).toBeVisible();
 const approval=op.getByRole('button',{name:'Approve unloading',exact:true}).click();await expect(mp.getByText('Unloading approved · Tracking completed',{exact:true})).toBeVisible();await shot(mp,'driver-approval-native-toast');await approval;await expect(op.getByText('Unloading approved. This shipment is complete.',{exact:true})).toBeVisible();
 assert.equal(checked(await db.from('provider_shipments').select('operational_status').eq('id',shipmentId).single()).operational_status,'COMPLETED');
 stage='driver web and Expo approval alerts';currentPage=mp;
 await expect(mp.getByText('Unloading approved · Tracking completed',{exact:true})).toBeVisible();await shot(mp,'driver-approval-native-toast');
 await expect.poll(async()=>(await notifications(dw)).some(item=>item.body==='Unloading approved · Tracking completed'),{timeout:30000}).toBe(true);
 await mp.getByRole('button',{name:/^Updates/}).click();await expect(mp.getByText('New',{exact:true})).toBeVisible();await shot(mp,'driver-approval-native-updates');await mp.getByRole('button',{name:'Close',exact:true}).click();
 await dw.getByRole('button',{name:/^Updates/}).click();await expect(dw.locator('.chat-alert-list').getByText('Unloading approved · Tracking completed',{exact:true})).toBeVisible();await shot(dw,'driver-approval-web-phone');await dw.setViewportSize({width:1440,height:1000});await shot(dw,'driver-approval-web-desktop');await dw.getByRole('button',{name:'Close',exact:true}).click();
 await mp.getByRole('button',{name:/^Updates/}).click();const acknowledged=mp.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/notifications/handover'&&response.request().method()==='POST');await mp.getByRole('button').filter({hasText:'Unloading approved · Tracking completed'}).click();const ack=await acknowledged;assert.equal(ack.status(),200);assert.deepEqual(Object.keys(ack.request().postDataJSON()).sort(),['approvedAt','id']);await expect(mp).toHaveURL(new RegExp('/shipment-detail\\?id='+shipmentId));await expect(mp.getByText('Completed',{exact:true}).first()).toBeVisible();
 await expect.poll(async()=>(await rpc('driver_handover_alert_snapshot',{actor_user_id:driver.id})).unreadCount).toBe(0);
 assert.deepEqual(errors,[]);console.log('PASS: actual owner email code and approval, retained real proof objects, committed completion, web system and Expo updates, explicit open acknowledgement and Tracking destination');
 }

}catch(error){console.log('CHECK: '+JSON.stringify({assertion:error.matcherResult?.name||null,path:currentPage?new URL(currentPage.url()).pathname:null,waitingNotification:currentPage?(await notifications(currentPage).catch(()=>[])).length:0,submit:await currentPage?.evaluate(()=>window.__alertAuditSubmit||null).catch(()=>null)}));await currentPage?.screenshot({path:new URL('.local/driver-browser-alert-failure.png',root).pathname,fullPage:true,mask:[currentPage.locator('input[autocomplete="one-time-code"]')]}).catch(()=>{});throw Error('DRIVER_BROWSER_ALERT_FAILED: '+stage+' · '+error.name);}
finally{
 for(const c of contexts)await c.close();for(const client of clients)await client.auth.signOut({scope:'local'});
 if(files.length)checked(await db.storage.from('shipment-proof').remove(files));
 if(chatId){checked(await db.from('support_conversations').delete().eq('id',chatId));checked(await db.from('audit_logs').delete().eq('entity_id',chatId));}
 if(shipmentId){for(const table of ['driver_handover_alert_reads','provider_tracking_appeals','provider_shipment_events','provider_tracking_recipients','shipment_party_grants','email_deliveries'])checked(await db.from(table).delete().eq('shipment_id',shipmentId));checked(await db.from('provider_shipments').delete().eq('id',shipmentId));checked(await db.from('audit_logs').delete().eq('entity_id',shipmentId));}
 if(vehicleId){checked(await db.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await db.from('vehicle_driver_locations').delete().eq('vehicle_id',vehicleId));checked(await db.from('vehicles').delete().eq('id',vehicleId));}
 for(const id of users){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.auth.admin.deleteUser(id));}
 await browser.close();console.log('CLEANUP: exact disposable Loadgistic local identities, shipment, chat and proof objects');
}
