import {test,expect} from './browser-test';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {createSessionToken,providerTrackingRecipientDigest} from '../../src/lib/security.js';
import {trackingSessionSubject} from '../../src/lib/tracking-session.js';

test('retired email Tracking cannot issue, renew or restore email-wide access',async({page,context},info)=>{
 test.setTimeout(60000);
 const service=localAuditService(),email='retired-tracking-'+randomUUID()+'@example.test';
 const id=randomUUID(),digest=providerTrackingRecipientDigest(email);
 const methods=[
  ['POST','/api/tracking/otp'],['POST','/api/tracking/unlock'],['POST','/api/tracking/session'],
  ['GET','/api/tracking/'+id+'/refresh'],['POST','/api/tracking/'+id+'/approve'],
  ['GET','/api/tracking/'+id+'/sharing'],['POST','/api/tracking/'+id+'/sharing']
 ];
 await page.goto('/track',{waitUntil:'domcontentloaded'});
 await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('6-digit email code')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Your shipments',exact:true})).toHaveCount(0);
 for(const [method,path]of methods){
  const response=await page.request.fetch(path,{method,...(method==='POST'?{form:{email,challengeId:id,code:'000000'}}:{})});
  expect(response.status(),method+' '+path).toBe(410);
  expect(response.headers()['cache-control']).toContain('no-store');
 }
 // Old cookies cannot gain a new five-minute per-load grant, even if signed.
 for(const sub of[trackingSessionSubject(digest,Date.now()),'provider-tracking:'+id+':'+digest]){
  await context.addCookies([{name:'lg_tracking_grant',value:createSessionToken(sub,1800),url:info.project.use.baseURL!,httpOnly:true,sameSite:'Lax'}]);
  expect((await page.request.post('/api/tracking/session')).status()).toBe(410);
  expect((await page.request.get('/api/tracking/'+id+'/refresh')).status()).toBe(410);
  expect((await context.cookies()).some(cookie=>cookie.name==='lg_tracking_link_grant')).toBe(false);
 }
 expect(checked(await service.from('access_email_deliveries').select('id').eq('recipient_email',email))).toHaveLength(0);
 expect(checked(await service.from('profiles').select('id').eq('email',email))).toHaveLength(0);
 await context.clearCookies();
});
