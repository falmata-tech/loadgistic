import {test,expect} from './browser-test';
import {localAuditService,auditIdentity} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

// FEAT-ENT-001 / FEAT-TRQ-001: the former platform Brokerage service is
// unavailable to old clients, while ordinary software Support remains usable.
test('retired transport intake and brokerage routes deny old clients without writing history',async({page,request})=>{
 test.setTimeout(120000);
 const db=localAuditService();
 async function rowCount(table:'transport_service_requests'|'transport_chat_messages'){
  const result=await db.from(table).select('id',{count:'exact',head:true});
  expect(result.error).toBeNull();
  return result.count;
 }
 const beforeRequests=await rowCount('transport_service_requests');
 const beforeMessages=await rowCount('transport_chat_messages');
 const endpoints:[string,string][]=[
  ['POST','/api/transport-requests'],
  ['GET','/api/transport-requests/conversation'],
  ['POST','/api/transport-requests/conversation'],
  ['POST','/api/transport-requests/conversation/read'],
  ['GET','/api/brokerage/updates'],
  ['GET','/api/brokerage/00000000-0000-4000-8000-000000000001/messages'],
  ['POST','/api/admin/transport-requests/00000000-0000-4000-8000-000000000001'],
  ['GET','/api/mobile/brokerage'],
  ['POST','/api/mobile/brokerage/start']
 ];
 for(const [method,path] of endpoints){
  const response=await request.fetch(path,{method,data:method==='POST'?{}:undefined});
  expect(response.status(),`${method} ${path}`).toBe(410);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await response.json()).toEqual({ok:false,error:{code:'PLATFORM_BROKERAGE_RETIRED',message:'This service is no longer available.'}});
 }
 for(const path of ['/','/about','/featured','/tracking']){
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:'Need help with transport?',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Arrange transport',exact:true})).toHaveCount(0);
 }
 for(const path of ['/brokerage','/arrange-transport']){
  await page.goto(path,{waitUntil:'domcontentloaded'});
  // Next streams the not-found page with a 200 transport status in dev mode.
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transport requests'})).toHaveCount(0);
 }
 expect(await rowCount('transport_service_requests')).toBe(beforeRequests);
 expect(await rowCount('transport_chat_messages')).toBe(beforeMessages);
});

test('platform team cannot grant Brokerage while administrator retains software Support',async({page})=>{
 const db=localAuditService();
 const admin=await auditIdentity(db,'admin@loadgistic.local');
 const logout=await localSupportLogin(page,admin.id);
 try{
  await page.goto('/admin/support?tab=team');
  await expect(page.getByRole('heading',{name:'Platform team'})).toBeVisible();
  await page.getByRole('button',{name:'Add member',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Add member',exact:true});
  await expect(form.getByRole('checkbox',{name:'Support',exact:true})).toBeVisible();
  await expect(form.getByRole('checkbox',{name:'Brokerage',exact:true})).toHaveCount(0);
  await page.goto('/admin/support');
  await expect(page.getByRole('heading',{name:'Provider support'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Brokerage',exact:true})).toHaveCount(0);
 }finally{await logout();}
});
