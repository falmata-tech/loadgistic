import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const env=readFileSync(new URL('../.env.local',import.meta.url),'utf8');assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const origin='http://127.0.0.1:3100';
async function get(path){const response=await fetch(origin+path,{signal:AbortSignal.timeout(60000)});assert.ok(response.headers.get('content-type')?.includes('application/json'));return {status:response.status,value:await response.json()};}
const publicCapacity=await get('/api/public/capacity');assert.equal(publicCapacity.status,200);const handles=[...new Set(publicCapacity.value.items.map(item=>item.provider_handle).filter(Boolean))];assert.ok(handles.length>0,'Published local fixtures required');
const featured=await get('/api/mobile/public/featured');assert.equal(featured.status,200);assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(featured.value.date));assert.equal(featured.value.week.length,7);assert.ok(Array.isArray(featured.value.trucks));assert.ok(Array.isArray(featured.value.programme));
function noPrivate(value){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){assert.ok(!['file_path','driver_user_id','vehicle_id','provider_profile_id','provider_organization_id','notes','plate_number'].includes(key),'Private field omitted');noPrivate(child);}}
noPrivate(featured.value);
let profiles=0,paged=false;
for(const handle of handles.slice(0,5)){const profile=await get(`/api/mobile/public/providers/${encodeURIComponent(handle)}`);assert.equal(profile.status,200);assert.equal(profile.value.handle,handle);noPrivate(profile.value);assert.ok(profile.value.trucks.length<=12);assert.ok(profile.value.fleet.total>=profile.value.trucks.length);profiles++;
 if(profile.value.fleet.pages>1&&!paged){const second=await get(`/api/mobile/public/providers/${encodeURIComponent(handle)}?page=2`);assert.equal(second.status,200);assert.equal(second.value.fleet.page,2);assert.equal(second.value.name,profile.value.name);const numbers=new Set(profile.value.trucks.map(item=>item.number));assert.ok(second.value.trucks.every(item=>!numbers.has(item.number)));paged=true;}
 if(profile.value.trucks[0]?.image){const image=await fetch(origin+profile.value.trucks[0].image);assert.equal(image.status,200);assert.ok(image.headers.get('content-type').startsWith('image/'));}
}
assert.equal((await get('/api/mobile/public/providers/no-such-local-provider')).status,404);
assert.equal((await get(`/api/mobile/public/providers/${encodeURIComponent(handles[0])}?page=-1`)).status,400);
assert.equal((await get('/api/mobile/public/providers/%3Cscript%3E')).status,400);
console.log(`PASS: anonymous Featured (${featured.value.trucks.length} scheduled pairs), ${profiles} public profiles, no private fields, truck images, invalid/missing handle denial; multi-page fixture checked=${paged}`);
