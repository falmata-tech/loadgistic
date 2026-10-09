import {test,expect} from '@playwright/test';
import type {APIRequestContext} from 'playwright-core';

test('retired overview input cannot switch public profile search to legacy aggregation',async({request}:{request:APIRequestContext})=>{
 const discovery=await request.get('/api/capacity-search');expect(discovery.status()).toBe(200);
 const profiles=await discovery.json();const company=profiles.items.find((item:{kind:string})=>item.kind==='COMPANY');expect(company).toBeTruthy();
 const query=new URLSearchParams({q:company.title,provider:company.handle,viewport:'30,3,49,15'});
 const response=await request.get('/api/public/capacity?'+query);expect(response.status()).toBe(200);const baseline=await response.json();expect(baseline.items.length).toBeGreaterThan(0);
 query.set('overview','1');const legacy=await request.get('/api/public/capacity?'+query);expect(legacy.status()).toBe(200);const result=await legacy.json();
 expect(result.items.map((item:{id:string})=>item.id)).toEqual(baseline.items.map((item:{id:string})=>item.id));
 expect(result.items.every((item:{provider_handle:string;status:string})=>item.provider_handle===company.handle&&['EMPTY','PARTIAL'].includes(item.status))).toBe(true);
 expect(result.clusters).toBeUndefined();expect(result.hasMore).toBe(baseline.hasMore);expect(result.nextCursor).toBe(baseline.nextCursor);
});
