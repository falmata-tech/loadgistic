import {test,expect} from '@playwright/test';
import type {APIRequestContext} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
test('callback API bounds input, rejects cross-origin writes and throttles anonymous abuse',async({request}:{request:APIRequestContext},info:{project:{name:string}})=>{
 const service=localAuditService(),id=randomUUID(),phone='+251900000001';
 const before=checked(await service.from('transport_service_requests').select('id').eq('id',id));expect(before).toHaveLength(0);
 const ip=info.project.name.includes('mobile')?'127.0.0.245':'127.0.0.244';const headers={'x-forwarded-for':ip};
 const cross=await request.post('/api/transport-requests',{headers:{...headers,Origin:'https://unrelated.invalid'},data:{requestId:id,name:'Private request',origin:'Adama',destination:'Bishoftu',phone}});expect(cross.status()).toBe(403);
 const huge=await request.post('/api/transport-requests',{headers,data:'x'.repeat(4100)});expect(huge.status()).toBe(413);
 const nullBody=await request.post('/api/transport-requests',{headers,data:'null'});expect(nullBody.status()).toBe(400);
 for(let n=0;n<3;n++)expect((await request.post('/api/transport-requests',{headers,data:{requestId:id,name:'',origin:'Adama',destination:'Bishoftu',phone}})).status()).toBe(400);
 const limited=await request.post('/api/transport-requests',{headers,data:{requestId:id,name:'Private request',origin:'Adama',destination:'Bishoftu',phone}});expect(limited.status()).toBe(429);expect(limited.headers()['retry-after']).toBeTruthy();
 expect(checked(await service.from('transport_service_requests').select('id').eq('id',id))).toHaveLength(0);
});
