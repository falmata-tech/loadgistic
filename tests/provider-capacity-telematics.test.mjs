import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {getAuthorizedVehicleLocationSelections,publishSupabaseProviderCapacity} from '../src/lib/provider-capacity/supabase.js';
const stamp='2026-10-15T12:00:00Z';
test('selected-source enrichment queries only bounded caller-authorized vehicle IDs and drops private fields',async()=>{
 const calls=[],ids=Array.from({length:205},(_,index)=>`vehicle-${index}`);
 const client=createClient('https://telematics.test.invalid','test-key',{global:{fetch:async(input)=>{
  const url=new URL(String(input));calls.push(url);const matches=url.searchParams.get('vehicle_id').match(/^in\.(.*)$/);assert.ok(matches);
  const requested=matches[1].slice(1,-1).split(',');assert.ok(requested.length<=100);
  return Response.json([...requested.map(vehicle_id=>({vehicle_id,source:'GPS',selected_at:stamp,precision_km:20,revision:stamp,manual_latitude:9.031,imei:'private'})),
    {vehicle_id:'another-owner',source:'MANUAL',selected_at:stamp,precision_km:1,revision:stamp,manual_latitude:50}]);
 }},auth:{persistSession:false,autoRefreshToken:false}});
 const rows=await getAuthorizedVehicleLocationSelections(client,[...ids,ids[0]]);
 assert.equal(calls.length,3);assert.equal(rows.size,205);assert.equal(rows.has('another-owner'),false);
 for(const url of calls){assert.equal(url.pathname,'/rest/v1/telematics_location_sources');assert.equal(url.searchParams.get('select'),'vehicle_id,source,selected_at,precision_km,revision');}
 assert.deepEqual(rows.get(ids[0]),{source:'GPS',selectedAt:stamp,precisionKm:20,revision:stamp});
});
test('an empty authorized workspace performs no source lookup',async()=>{
 const rows=await getAuthorizedVehicleLocationSelections({from:()=>{throw new Error('UNSCOPED_QUERY');}},[]);assert.equal(rows.size,0);
});
test('malformed source metadata fails without a fabricated fallback',async()=>{
 const client=createClient('https://telematics.test.invalid','test-key',{global:{fetch:async()=>Response.json([{vehicle_id:'own',source:'GPS',selected_at:'invalid',precision_km:20,revision:stamp}])},auth:{persistSession:false,autoRefreshToken:false}});
 await assert.rejects(()=>getAuthorizedVehicleLocationSelections(client,['own']),/SUPABASE_PROVIDER_CAPACITY_WORKSPACE_FAILED/);
});
test('pending selected source remains an actionable safe domain error',async()=>{
 const prior={fetch:globalThis.fetch,log:console.error,url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY},logs=[];
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://telematics.test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';console.error=(...args)=>logs.push(args);
 globalThis.fetch=async()=>Response.json({code:'P0001',message:'LOCATION_SOURCE_PENDING',details:'private device coordinates'},{status:400});
 try{
  await assert.rejects(()=>publishSupabaseProviderCapacity({id:'owner'},{vehicleId:'own',status:'EMPTY'}),error=>error.message==='LOCATION_SOURCE_PENDING');assert.deepEqual(logs,[]);
  const source=await readFile(new URL('../src/lib/errors.ts',import.meta.url),'utf8');
  const {errorMessage}=await import(`data:text/javascript,${encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText)}`);
  assert.match(errorMessage(new Error('LOCATION_SOURCE_PENDING')),/GPS device needs a new location/);assert.doesNotMatch(errorMessage(new Error('LOCATION_SOURCE_PENDING')),/P0001|private|LOCATION_SOURCE_PENDING/);
 }finally{globalThis.fetch=prior.fetch;console.error=prior.log;for(const [name,value]of[['NEXT_PUBLIC_SUPABASE_URL',prior.url],['SUPABASE_SERVICE_ROLE_KEY',prior.key]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
