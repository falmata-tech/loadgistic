import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const env=readFileSync(new URL('../.env.local',import.meta.url),'utf8');assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
async function get(path,token){const response=await fetch('http://127.0.0.1:3100'+path,{headers:token?{Authorization:`Bearer ${token}`}:{},signal:AbortSignal.timeout(60000)});assert.ok(response.headers.get('content-type')?.includes('application/json'));return{status:response.status,body:await response.json()};}
const publicSearch=await get('/api/mobile/public/discovery');assert.equal(publicSearch.status,200);assert.ok(publicSearch.body.items.length);assert.equal(publicSearch.body.configurations.length,15);
const company=publicSearch.body.items.find(item=>item.kind==='COMPANY')||publicSearch.body.items[0];
const searched=await get('/api/mobile/public/discovery?q='+encodeURIComponent(company.title));assert.equal(searched.status,200);assert.ok(searched.body.items.some(item=>item.key===company.key));
const byHandle=await get('/api/mobile/public/discovery?provider='+encodeURIComponent(company.handle));assert.equal(byHandle.status,200);assert.ok(byHandle.body.items.every(item=>item.handle===company.handle));
const map=await get('/api/public/capacity?provider='+encodeURIComponent(company.handle));assert.equal(map.status,200);assert.ok(map.body.items.length);assert.ok(map.body.items.every(item=>item.provider_handle===company.handle));
const category=map.body.items[0].cargo_configuration;
const filtered=await get('/api/mobile/public/discovery?'+new URLSearchParams({provider:company.handle,vehicleCategory:category}));assert.equal(filtered.status,200);assert.ok(filtered.body.items.length);
for(const query of ['view=loadgistic','digest=000','status=FULL','loadType=FTL&status=PARTIAL','q='+encodeURIComponent('x'.repeat(121)),'truckCityPlaceRef=invalid-place'])assert.equal((await get('/api/mobile/public/discovery?'+query)).status,400);
assert.equal((await get('/api/mobile/visitor/capacity/search')).status,401);
// Account-only Capacity rejects old visitor credentials and unsigned requests.
for(const path of ['/api/mobile/visitor/capacity/search','/api/mobile/visitor/capacity/signals','/api/account-capacity']){
 const response=await get(path);assert.equal(response.status,401,path);
}
const retired=await get('/api/shared-capacity');assert.equal(retired.status,410);
console.log('PASS: public discovery and map match; malformed filters reject; private Capacity requires a signed-in account. No database writes.');
