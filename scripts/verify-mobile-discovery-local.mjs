import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from '../src/lib/security.js';
import { visitorSubject } from '../src/lib/mobile/visitor-policy.js';
const env=readFileSync(new URL('../.env.local',import.meta.url),'utf8');assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
for(const key of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SESSION_SECRET']){const value=env.match(new RegExp(`^${key}=(.*)$`,'m'))?.[1]?.trim();if(value)process.env[key]=value.replace(/^['"]|['"]$/g,'');}
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
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
// Signed LOCAL test grants exercise isolation; inbox OTP is tested separately.
const unrelated=createSessionToken(visitorSubject('capacity','1'.repeat(64),Date.now()),1800),wrongScope=createSessionToken(visitorSubject('tracking','1'.repeat(64),Date.now()),1800);
assert.equal((await get('/api/mobile/visitor/capacity/search',wrongScope)).status,401);
const empty=await get('/api/mobile/visitor/capacity/search',unrelated);assert.equal(empty.status,200);assert.equal(empty.body.items.length,0);
assert.equal((await get('/api/mobile/visitor/capacity/signals?view=loadgistic',unrelated)).status,400);
const {data:grants,error}=await client.from('capacity_access_grants').select('recipient_email_digest').eq('audience_type','EMAIL').is('revoked_at',null).limit(30);assert.ifError(error);
let populated=false;
for(const grant of grants||[]){const token=createSessionToken(visitorSubject('capacity',grant.recipient_email_digest,Date.now()),1800),shared=await get('/api/mobile/visitor/capacity/signals',token);assert.equal(shared.status,200);if(!shared.body.items.length)continue;
 const result=await get('/api/mobile/visitor/capacity/search',token);assert.equal(result.status,200);assert.ok(result.body.items.length);const handles=new Set(shared.body.items.map(row=>row.provider_handle));assert.ok(result.body.items.every(row=>handles.has(row.handle)));
 const category=shared.body.items[0].cargo_configuration,query=new URLSearchParams({vehicleCategory:category});const matching=await get('/api/mobile/visitor/capacity/signals?'+query,token),profiles=await get('/api/mobile/visitor/capacity/search?'+query,token);assert.equal(matching.status,200);assert.equal(profiles.status,200);assert.ok(matching.body.items.every(row=>row.cargo_configuration===category));assert.ok(profiles.body.items.length);
 assert.equal((await get('/api/mobile/visitor/capacity/search',token+'x')).status,401);populated=true;break;
}
assert.equal(populated,true,'Local active shared fixture required');
console.log('PASS: public name/handle/configuration matching; corresponding map trucks; malformed filter denial; private grant/cross-scope/forgery/no-grant isolation; populated private profiles and truck filters. No database writes.');
