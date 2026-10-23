import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {mobileCatalogPlace} from '../src/lib/mobile/place-projection.js';
import {normalizePublicAccountIdentity} from '../src/lib/provider-public-identity.js';

const vehicleId='00000000-0000-4000-8000-000000000001',expectedDriverId='00000000-0000-4000-8000-000000000002',routeId='00000000-0000-4000-8000-000000000003';
function load(path,ports){const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>{if(!(name in ports))throw Error(`UNEXPECTED_IMPORT:${name}`);return ports[name];},exports);return exports;}
const regular=()=>load('src/lib/mobile/regular-contract.ts',{'zod':{z},'./place-projection.js':{mobileCatalogPlace}});
class MobileError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
function nativeRoute(actor={id:'actor',driver_kind:'COMPANY'},application={}){
 const calls=[];
 const route=load('src/app/api/mobile/regular-service/route.ts',{
  '@/lib/mobile/server':{MobileError,mobileActor:async()=>{if(!actor)throw new MobileError(401,'UNAUTHORIZED','Sign in');return actor;},mobileBody:request=>request.json(),mobileJson:value=>Response.json(value),mobileFailure:error=>Response.json({error:{code:error.code||'UNAVAILABLE'}},{status:error.status||500})},
  '@/lib/provider-capacity.js':{getProviderRegularCapacity:async(user,input)=>{calls.push(['read',user,input]);return {corridors:[]};},getProviderCapacityWorkspace:async()=>({corridors:[]}),addProviderRegularCapacity:async(...args)=>calls.push(['save',...args]),removeProviderRegularCapacity:async(...args)=>calls.push(['remove',...args]),...application},
  '@/lib/mobile/regular-contract':regular(),'@/lib/errors':{errorMessage:()=> 'Please retry'},
 });return {route,calls};
}
const command={action:'SAVE',vehicleId,expectedDriverId,replaceId:null,geometry:'ROUTE',routePlaces:[{placeRef:'city-a'},{placeRef:'city-b'}],areaCenterPlaceRef:'',areaBoundaryPlaces:[]};
const post=value=>new Request('http://localhost/api/mobile/regular-service',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
test('native exact-pair read permits assigned company Driver and rejects missing/repeated scope without querying',async()=>{
 const {route,calls}=nativeRoute();
 assert.equal((await route.GET(new Request(`http://localhost/api/mobile/regular-service?vehicleId=${vehicleId}&expectedDriverId=${expectedDriverId}`))).status,200);
 assert.deepEqual(calls[0][2],{vehicleId,expectedDriverId});
 for(const query of ['',`vehicleId=${vehicleId}`,`vehicleId=${vehicleId}&vehicleId=${vehicleId}&expectedDriverId=${expectedDriverId}`,`vehicleId=invalid&expectedDriverId=${expectedDriverId}`])assert.equal((await route.GET(new Request(`http://localhost/api/mobile/regular-service?${query}`))).status,400);
 assert.equal(calls.length,1);
});
test('native SAVE/REMOVE carry exact pair and stale/permission failures deny without returning private data',async()=>{
 const {route,calls}=nativeRoute({id:'actor',driver_kind:null});assert.equal((await route.POST(post(command))).status,200);assert.deepEqual(calls[0][2],command);assert.equal(calls[0][3],null);
 const remove={action:'REMOVE',vehicleId,expectedDriverId,id:routeId,confirm:true};assert.equal((await route.POST(post(remove))).status,200);assert.deepEqual(calls[1].slice(1),[{id:'actor',driver_kind:null},routeId,{vehicleId,expectedDriverId}]);
 for(const [error,status] of [['TRUCK_DRIVER_CHANGED',409],['FORBIDDEN',403],['NOT_FOUND',403]]){const denied=nativeRoute({id:'actor'},{addProviderRegularCapacity:async()=>{throw Error(error);}});assert.equal((await denied.route.POST(post(command))).status,status);}
 const company=nativeRoute({id:'driver',driver_kind:'COMPANY',can_manage_capacity:true});assert.equal((await company.route.POST(post(command))).status,403);assert.equal(company.calls.length,0);
});
test('old native route mutation and unauthenticated requests fail closed',async()=>{
 const {route,calls}=nativeRoute({id:'actor'});const old={...command};delete old.vehicleId;delete old.expectedDriverId;
 assert.equal((await route.POST(post(old))).status,400);assert.equal(calls.length,0);
 const anonymous=nativeRoute(null);assert.equal((await anonymous.route.POST(post(command))).status,401);assert.equal((await anonymous.route.GET(new Request('http://localhost/api/mobile/regular-service'))).status,401);assert.equal(anonymous.calls.length,0);
});
test('application scoped read never chooses an unrelated, unbound or stale provider route',async()=>{
 const workspace={vehicles:[{id:vehicleId,assigned_driver:{id:expectedDriverId}}],corridors:[{id:'legacy'},{id:'stale',vehicle_id:vehicleId,driver_user_id:'other-driver'},{id:routeId,vehicle_id:vehicleId,driver_user_id:expectedDriverId}]};
 const application=load('src/lib/provider-capacity.js',{'./provider-capacity/supabase.js':{getSupabaseProviderCapacityWorkspace:async()=>workspace}});
 const scoped=await application.getProviderRegularCapacity({id:'actor'},{vehicleId,expectedDriverId});assert.deepEqual(scoped.corridors.map(item=>item.id),[routeId]);
 await assert.rejects(()=>application.getProviderRegularCapacity({id:'actor'},{vehicleId,expectedDriverId:'other-driver'}),/TRUCK_DRIVER_CHANGED/);
 await assert.rejects(()=>application.getProviderRegularCapacity({id:'actor'},{vehicleId:'foreign',expectedDriverId}),/NOT_FOUND/);
});
test('current and old mobile profile clients keep About updates while retired Services never enter writes or reads',async()=>{
 const calls=[];
 const route=load('src/app/api/mobile/profile/route.ts',{
  zod:{z},'@/lib/mobile/server':{MobileError,mobileActor:async()=>({id:'actor'}),mobileBody:request=>request.json(),mobileJson:value=>Response.json(value),mobileFailure:error=>Response.json({error:{code:error.code||'UNAVAILABLE'}},{status:error.status||500})},
  '@/lib/provider-profile.js':{getOwnCompanyPage:async()=>({about:'Keep About',services:'RETIRED-SERVICE'}),updateCompanyPage:async(user,input)=>calls.push(input)},'@/lib/provider-regions.js':{PROVIDER_REGIONS:[]},'@/lib/errors':{errorMessage:()=> 'Please retry'},
 });
 const profile={headline:'Headline',about:'Updated About',basePlaceRef:'city-a',baseRegionCode:'ADDIS_ABABA',contactPhone:'',contactWhatsapp:'',contactEmail:'',contactWebsite:'',showContactPhone:false,showContactWhatsapp:false,showContactEmail:false,showContactWebsite:false,published:false};
 for(const value of [profile,{...profile,services:'OLD-CLIENT-OVERWRITE'}]){assert.equal((await route.POST(new Request('http://localhost/api/mobile/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}))).status,200);}
 assert.ok(calls.every(input=>input.about==='Updated About'&&!('services' in input)));
 const projected=await (await route.GET(new Request('http://localhost/api/mobile/profile'))).json();assert.equal(projected.profile.about,'Keep About');assert.equal(projected.profile.services,'');assert.equal(JSON.stringify(projected).includes('RETIRED-SERVICE'),false);
});
test('web regular forms retain exact truck context and reject repeated or missing scope before mutation',async()=>{
 let actor={id:'owner'};const calls=[];
 const route=load('src/app/api/capacity/corridors/route.ts',{
  'next/server.js':{NextResponse:{json:(value,init)=>Response.json(value,init),redirect:(url,status)=>new Response(null,{status,headers:{Location:String(url)}})}},
  '@/lib/auth':{getCurrentUser:async()=>actor},'@/lib/provider-capacity.js':{addProviderRegularCapacity:async(...args)=>calls.push(['save',...args]),removeProviderRegularCapacity:async(...args)=>calls.push(['remove',...args])},
  '@/lib/mobile/regular-contract':regular(),'@/lib/errors':{errorMessage:error=>error.message},'@/lib/redirects':{text:(form,key)=>String(form.get(key)||''),redirectWith:()=>new Response(null,{status:303})},
 });
 const request=(values,duplicate=false)=>{const form=new FormData();for(const [key,value]of Object.entries(values))form.append(key,value);if(duplicate)form.append('vehicleId',vehicleId);return new Request('http://localhost/api/capacity/corridors',{method:'POST',headers:{Accept:'application/json'},body:form});};
 const input={vehicleId,expectedDriverId,action:'UPDATE',id:routeId,geometry:'ROUTE',returnTo:'/app/fleet/current'};
 assert.equal((await route.POST(request(input))).status,200);assert.equal(calls[0][2].vehicleId,vehicleId);assert.equal(calls[0][2].expectedDriverId,expectedDriverId);assert.equal(calls[0][3],routeId);
 assert.equal((await route.POST(request({...input,action:'REMOVE'}))).status,200);assert.deepEqual(calls[1][3],{vehicleId,expectedDriverId});
 assert.equal((await route.POST(request(input,true))).status,400);assert.equal((await route.POST(request({action:'ADD',geometry:'ROUTE'}))).status,400);assert.equal(calls.length,2);
 actor=null;assert.equal((await route.POST(request(input))).status,401);assert.equal(calls.length,2);
});
test('Supabase adapter sends scoped regular commands and never sends retired Services',async()=>{
 const calls=[],client={rpc:async(name,args)=>{calls.push([name,args]);return {data:routeId,error:null};}};
 const capacity=load('src/lib/provider-capacity/supabase.js',{'../private-capacity-contact.js':{},'../security.js':{},'../domain.js':{},'../supabase-adapter.js':{createSupabaseAdminClient:()=>client},'../independent-driver.js':{},'../phone-location-command.js':{},'../provider-authority.js':{}});
 const actor={id:'authenticated-actor'};
 await capacity.addSupabaseProviderRegularCapacity(actor,command);
 await capacity.addSupabaseProviderRegularCapacity(actor,command,routeId);
 await capacity.removeSupabaseProviderRegularCapacity(actor,routeId,{vehicleId,expectedDriverId});
 assert.deepEqual(calls.map(call=>call[0]),['add_provider_regular_capacity','replace_provider_regular_capacity','remove_provider_regular_capacity']);
 for(const [,args]of calls.slice(0,2)){assert.equal(args.actor_user_id,actor.id);assert.equal(args.command.vehicle_id,vehicleId);assert.equal(args.command.expected_driver_id,expectedDriverId);assert.deepEqual(args.command.route_places,[{place_ref:'city-a'},{place_ref:'city-b'}]);}
 assert.deepEqual(calls[2][1],{actor_user_id:actor.id,target_route_id:routeId,target_vehicle_id:vehicleId,expected_driver_user_id:expectedDriverId});
 const profile=load('src/lib/provider-profile/supabase.js',{'../private-upload-commit.js':{},'../private-storage.js':{},'../supabase-adapter.js':{createSupabaseAdminClient:()=>client},'../provider-public-identity.js':{normalizePublicAccountIdentity}});
 await profile.updateSupabaseCompanyPage(actor,{about:'Updated About',services:'OLD-CLIENT-OVERWRITE'});
 assert.equal(calls[3][0],'update_provider_profile_page');assert.equal(calls[3][1].command.about,'Updated About');assert.equal('services' in calls[3][1].command,false);
});
