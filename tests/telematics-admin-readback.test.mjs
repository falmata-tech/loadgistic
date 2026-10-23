import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {adminDemoIntake,adminDeviceProvisionCommand,adminDeviceRegistrationCommand} from '../src/lib/telematics-admin-provision.js';
import {isDemoAdminSpare,gpsDeviceDisplayLabel} from '../src/lib/demo-admin-spare.js';

test('saved Demo spare has a stable display name when its vehicle assignment changes',()=>{
 const spare={imei:'990000000000013',synthetic:true,label:'Demo GPS for Truck 02'};
 assert.equal(gpsDeviceDisplayLabel(spare),'Demo GPS 02');
 assert.equal(gpsDeviceDisplayLabel({...spare,vehicleId:randomUUID()}),'Demo GPS 02');
 assert.equal(gpsDeviceDisplayLabel({...spare,synthetic:false}),spare.label);
});

function loadReadback({record,query,cohort={'company-truck':{imei:'990000000000001'}},method='getAdminProviderDevices',client}){
 const source=readFileSync(new URL('../src/lib/telematics.js',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 new Function('require','exports',code)(name=>{
  if(name==='./supabase-adapter.js')return {createSupabaseAdminClient:()=>client||({from:()=>query})};
  if(name==='./platform-admin/supabase.js')return {getAdminOperationRecord:record};
  if(name==='./telematics-contract.js')return {deviceCommandSchema:{parse:value=>value}};
  if(name==='./telematics-gateway-auth.js')return {};
  if(name==='./demo-motion-cohort.js')return {DEMO_MOTION_COHORT:cohort};
  if(name==='./demo-admin-spare.js')return {DEMO_ADMIN_SPARE:{vehicleId:randomUUID(),imei:'990000000000013',label:'Demo GPS for Truck 02'},isDemoAdminSpare};
  throw Error(`UNEXPECTED_IMPORT:${name}`);
 },exports);
 return exports[method];
}

test('Admin spare command and engine step-up are refused without revealing the device to another provider',async()=>{
 const id=randomUUID(),calls=[];let stored={imei:'990000000000013',synthetic:true};
 const client={from(name){assert.equal(name,'telematics_devices');return {select(){return this;},eq(column,value){assert.equal(column,'id');assert.equal(value,id);return this;},async maybeSingle(){return {data:stored,error:null};}};},
  async rpc(name){calls.push(name);return {data:null,error:{message:'NOT_FOUND'}};}};
 const request=loadReadback({record:async()=>null,client,method:'requestDeviceCommand'});
 await assert.rejects(()=>request({id:randomUUID()},{deviceId:id,command:'LOCATE'}),/NOT_FOUND/);
 const stepUp=loadReadback({record:async()=>null,client,method:'authorizeSyntheticEngineStepUp'});
 await assert.rejects(()=>stepUp({id:randomUUID()},{deviceId:id,vehicleId:randomUUID(),command:'ENGINE_CUT'}),/NOT_FOUND/);
 assert.deepEqual(calls,[]);
 stored=null;
 await assert.rejects(()=>request({id:randomUUID()},{deviceId:id,command:'LOCATE'}),/NOT_FOUND/);
 await assert.rejects(()=>stepUp({id:randomUUID()},{deviceId:id,vehicleId:randomUUID(),command:'ENGINE_CUT'}),/NOT_FOUND/);
 assert.deepEqual(calls,['request_telematics_command','authorize_synthetic_engine_command']);
});

test('admin provider search filters transport providers before pagination and rechecks authority',async()=>{
 const actor={id:randomUUID(),role:'ADMIN',active:true},calls=[];
 const organizations=Array.from({length:9},(_,index)=>({id:randomUUID(),name:`Transport ${index+1}`}));
 const profiles=Array.from({length:4},(_,index)=>({id:randomUUID(),business_name:`Driver ${index+1}`}));
 const client={rpc(name,args){calls.push(['rpc',name,args]);return Promise.resolve({data:[],error:null});},from(table){let head=false;
  const builder={select(_columns,options){head=Boolean(options?.head);return this;},eq(column,value){calls.push([table,'eq',column,value]);return this;},
   ilike(column,pattern){calls.push([table,'ilike',column,pattern]);return this;},order(){return this;},
   async maybeSingle(){return {data:{role:'ADMIN',active:true},error:null};},
   async range(start,end){calls.push([table,'range',start,end]);return {data:(table==='organizations'?organizations:profiles).slice(start,end+1),error:null};},
   then(resolve){return Promise.resolve({count:table==='organizations'?organizations.length:profiles.length,error:null}).then(resolve);}};
  return builder;
 }};
 const search=loadReadback({record:async()=>null,query:null,client,method:'searchAdminTransportProviders'});
 const result=await search(actor,'Transport',2,8);
 assert.equal(result.pagination.total,13);assert.equal(result.pagination.pageCount,2);
 assert.equal(result.items.length,5);assert.equal(result.items[0].name,'Transport 9');
 assert.ok(result.items.slice(1).every(row=>row.record_kind==='PROVIDER_PROFILE'));
 assert.ok(calls.some(call=>call[0]==='organizations'&&call[1]==='eq'&&call[2]==='type'&&call[3]==='TRANSPORT_COMPANY'));
 assert.ok(calls.some(call=>call[0]==='rpc'&&call[1]==='managed_admin_operations_page'&&call[2].actor_user_id===actor.id&&call[2].requested_view==='WORKSPACES'));
 assert.deepEqual(calls.filter(call=>call[1]==='range').map(call=>[call[0],call[2],call[3]]),[['organizations',8,8],['provider_profiles',0,6]]);
 await assert.rejects(()=>search({...actor,role:'SUPPORT'},'Transport'),/FORBIDDEN/);
});

test('admin GPS readback stays scoped to one independently checked provider',async()=>{
 const id=randomUUID(),actor={id:randomUUID(),role:'ADMIN',active:true},calls=[];
 const owner={id,name:'Example Transport',record_kind:'ORGANIZATION',type:'TRANSPORT_COMPANY'};
 const query={select(columns,options){calls.push(['select',columns,options]);return this;},eq(column,value){calls.push(['eq',column,value]);return this;},in(column,values){calls.push(['in',column,values]);return this;},is(column,value){calls.push(['is',column,value]);return Promise.resolve({data:[],error:null});},order(column){calls.push(['order',column]);return this;},
  async range(start,end){calls.push(['range',start,end]);return {data:[{id:randomUUID(),label:'Synthetic GPS one',imei:'990000000000001',synthetic:true}],count:1,error:null};}};
 let checks=0;const read=loadReadback({record:async(current,view,ownerId,kind)=>{checks++;assert.equal(current,actor);assert.equal(view,'WORKSPACES');assert.equal(ownerId,id);assert.equal(kind,'ORGANIZATION');return owner;},query});
 const result=await read(actor,id,'ORGANIZATION',2);
 assert.equal(result.owner,owner);assert.equal(result.items[0].synthetic,true);assert.equal(result.total,1);assert.equal(checks,2);
 assert.equal(result.items[0].label,'Demo GPS for Truck 01');
 assert.deepEqual(calls.find(call=>call[0]==='eq'),['eq','organization_id',id]);
 assert.deepEqual(calls.find(call=>call[0]==='range'),['range',20,39]);
 await assert.rejects(()=>read({...actor,role:'SUPPORT'},id,'ORGANIZATION'),/FORBIDDEN/);
 await assert.rejects(()=>read(actor,randomUUID(),'INVALID'),/FORBIDDEN/);
});

test('admin readback resolves only the selected provider’s current vehicle assignment',async()=>{
 const actor={id:randomUUID(),role:'ADMIN',active:true},ownerId=randomUUID(),deviceId=randomUUID(),vehicleId=randomUUID(),calls=[];
 const client={from(table){const query={select(){return this;},eq(column,value){calls.push([table,'eq',column,value]);return this;},
   in(column,values){calls.push([table,'in',column,values]);return this;},
   is(column,value){calls.push([table,'is',column,value]);return Promise.resolve({data:[{device_id:deviceId,vehicle_id:vehicleId}],error:null});},
   order(){return this;},async range(){return {data:[{id:deviceId,label:'Demo GPS for Truck 02',imei:'990000000000013',synthetic:true}],count:1,error:null};},
   then(resolve){return Promise.resolve({data:[{id:vehicleId,platform_number:'Truck 02',make:'Kia',model:'Bongo Box'}],error:null}).then(resolve);}};
  return query;}};
 const read=loadReadback({record:async()=>({id:ownerId,name:'BlueLine',record_kind:'ORGANIZATION',type:'TRANSPORT_COMPANY'}),client,method:'getAdminProviderDevices'});
 const result=await read(actor,ownerId,'ORGANIZATION',1);
 assert.equal(result.items[0].assignedVehicleLabel,'Truck 02 · Kia · Bongo Box');
 assert.ok(calls.some(call=>call[0]==='telematics_device_assignments'&&call[1]==='is'&&call[2]==='ended_at'&&call[3]===null));
 assert.ok(calls.some(call=>call[0]==='vehicles'&&call[1]==='eq'&&call[2]==='organization_id'&&call[3]===ownerId));
});

test('admin GPS readback discards rows if permission changes during query',async()=>{
 const id=randomUUID(),actor={id:randomUUID(),role:'ADMIN',active:true};let checks=0;
 const read=loadReadback({record:async()=>++checks===1?{id,record_kind:'PROVIDER_PROFILE',type:'INDEPENDENT_PROVIDER',name:'Example'}:null,
  query:{select(){return this;},eq(){return this;},in(){return this;},is(){return Promise.resolve({data:[],error:null});},order(){return this;},async range(){return {data:[{id:randomUUID(),label:'Private GPS',synthetic:false}],count:1,error:null};}}});
 await assert.rejects(()=>read(actor,id,'PROVIDER_PROFILE'),/NOT_FOUND/);
 assert.equal(checks,2);
});

test('demo intake accepts only an exact fictional IMEI and provider vehicle owner',async()=>{
 const actor={id:randomUUID(),role:'ADMIN',active:true},ownerOrganizationId=randomUUID(),vehicleId=randomUUID(),imei='990000000000011';
 const query={select(){return this;},eq(column,value){assert.equal(column,'id');assert.equal(value,vehicleId);return this;},
  async maybeSingle(){return {data:{id:vehicleId,active:true,organization_id:ownerOrganizationId,provider_profile_id:null},error:null};}};
 const check=loadReadback({record:async()=>null,query,cohort:{fixture:{vehicleId,imei}},method:'assertAdminDemoFixtureBinding'});
 const command={ownerOrganizationId,imei,protocol:'gt06',protocolDeviceId:imei,synthetic:true};
 await check(actor,command);
 for(const patch of [{imei:'990000000000099'},{ownerOrganizationId:randomUUID()},{protocolDeviceId:'wrong-id'},{synthetic:false}])
  await assert.rejects(()=>check(actor,{...command,...patch}),/DEMO_FIXTURE_UNAVAILABLE/);
 await assert.rejects(()=>check({...actor,role:'SUPPORT'},command),/FORBIDDEN/);
});

test('admin GPS route permits only an active administrator and sends server-bound demo state',async()=>{
 const source=readFileSync(new URL('../src/app/api/admin/telematics/devices/route.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ownerOrganizationId=randomUUID(),demoGatewayId=randomUUID(),body={mode:'DEMO',ownerOrganizationId,imei:'990000000000041'};
 let actor={id:randomUUID(),role:'ADMIN',active:true},saved=[];
 const ports={
  '@/lib/auth':{getCurrentUser:async()=>actor},
  '@/lib/telematics.js':{adminProvisionDevice:async(_actor,command)=>{saved.push(command);return {id:randomUUID()};},getAdminProviderDevices:async()=>({}),assertAdminDemoFixtureBinding:async()=>({label:'Fictional GPS',registration:'READ'}),assertPhysicalGatewayAvailable:async()=>{},assertSyntheticGatewayAvailable:async()=>{},reconcileAdminProvisionedDevice:async()=>null},
  '@/lib/telematics-gateway-registration.js':{registerPhysicalGatewayDevice:async()=>41,registerAdminSpareGatewayDevice:async()=>41,readSyntheticGatewayDevice:async()=>41},
  '@/lib/mobile/server':{mobileBody:async()=>body,mobileJson:value=>value,mobileFailure:error=>({status:error.status||503,error:error.message}),MobileError:class extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}},
  '@/lib/telematics-http':{telematicsFailure:error=>error},
  '@/lib/rate-limit.js':{checkRateLimit:async()=>({allowed:true})},
  '@/lib/telematics-admin-provision.js':{adminDemoIntake,adminDeviceProvisionCommand,adminDeviceRegistrationCommand:()=>{throw Error('UNEXPECTED_REAL_REGISTRATION');}},
 };
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in ports,`Unexpected import ${name}`);return ports[name];},exports);
 const prior=process.env.TELEMATICS_DEMO_GATEWAY_ID;process.env.TELEMATICS_DEMO_GATEWAY_ID=demoGatewayId;
 try{
  const success=await exports.POST({});assert.equal(success.ok,true);assert.equal(saved.length,1);
  assert.equal(saved[0].gatewayId,demoGatewayId);assert.equal(saved[0].synthetic,true);
  actor={...actor,role:'SUPPORT'};const denied=await exports.POST({});assert.equal(denied.status,403);assert.equal(saved.length,1);
  actor={...actor,role:'ADMIN',active:false};const inactive=await exports.POST({});assert.equal(inactive.status,403);assert.equal(saved.length,1);
  actor={...actor,active:true};delete process.env.TELEMATICS_DEMO_GATEWAY_ID;
  const noGateway=await exports.POST({});assert.equal(noGateway.status,503);assert.equal(saved.length,1);
  process.env.TELEMATICS_DEMO_GATEWAY_ID=demoGatewayId;body.synthetic=false;
  const spoofed=await exports.POST({});assert.equal(spoofed.error,'INVALID_DEVICE_PROVISION');assert.equal(saved.length,1);
  delete body.synthetic;
 }finally{if(prior===undefined)delete process.env.TELEMATICS_DEMO_GATEWAY_ID;else process.env.TELEMATICS_DEMO_GATEWAY_ID=prior;}
});

test('real enrollment authorizes provider and physical gateway before registration, then reconciles retries',async()=>{
 const source=readFileSync(new URL('../src/app/api/admin/telematics/devices/route.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const gatewayId=randomUUID(),ownerOrganizationId=randomUUID(),actor={id:randomUUID(),role:'ADMIN',active:true};
 const body={mode:'REAL',enrollment:'REGISTER',ownerOrganizationId,imei:'353456789012345',protocol:'gt06',
  protocolDeviceId:'353456789012345',model:'GT06 hardware',label:'Provider tracker'};
 let existing=null,canRead=true,linkFails=false;const calls=[];
 const ports={
  '@/lib/auth':{getCurrentUser:async()=>actor},
  '@/lib/telematics.js':{
   getAdminProviderDevices:async()=>{calls.push('owner');if(!canRead)throw Error('NOT_FOUND');},
   assertPhysicalGatewayAvailable:async()=>{calls.push('physical');},
   assertSyntheticGatewayAvailable:async()=>{throw Error('UNEXPECTED_SYNTHETIC');},
   reconcileAdminProvisionedDevice:async()=>{calls.push('reconcile');return existing;},
   adminProvisionDevice:async(_user,command)=>{calls.push('link');assert.equal(command.gatewayDeviceId,41);
    if(linkFails)throw Error('APP_FAILED');return {id:randomUUID()};},
  },
  '@/lib/telematics-gateway-registration.js':{registerPhysicalGatewayDevice:async command=>{calls.push('register');assert.equal(command.gatewayId,gatewayId);return 41;},registerAdminSpareGatewayDevice:async()=>{throw Error('UNEXPECTED_SYNTHETIC');}},
  '@/lib/mobile/server':{mobileBody:async()=>body,mobileJson:value=>value,mobileFailure:error=>({error:error.message}),MobileError:class extends Error{}},
  '@/lib/telematics-http':{telematicsFailure:error=>error},
  '@/lib/rate-limit.js':{checkRateLimit:async()=>({allowed:true})},
  '@/lib/telematics-admin-provision.js':{adminDemoIntake,adminDeviceProvisionCommand,adminDeviceRegistrationCommand},
 };
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in ports,`Unexpected import ${name}`);return ports[name];},exports);
 const prior=process.env.TELEMATICS_DEFAULT_GATEWAY_ID;process.env.TELEMATICS_DEFAULT_GATEWAY_ID=gatewayId;
 try{
  assert.equal((await exports.POST({})).ok,true);
  assert.deepEqual(calls,['owner','physical','register','reconcile','link']);
  calls.length=0;existing={id:randomUUID(),reused:true};assert.equal((await exports.POST({})).result.reused,true);
  assert.deepEqual(calls,['owner','physical','register','reconcile']);
  calls.length=0;existing=null;canRead=false;assert.equal((await exports.POST({})).error,'NOT_FOUND');
  assert.deepEqual(calls,['owner']);
  calls.length=0;canRead=true;linkFails=true;assert.equal((await exports.POST({})).error,'GATEWAY_REGISTRATION_PENDING_LINK');
  assert.deepEqual(calls,['owner','physical','register','reconcile','link','reconcile']);
 }finally{if(prior===undefined)delete process.env.TELEMATICS_DEFAULT_GATEWAY_ID;else process.env.TELEMATICS_DEFAULT_GATEWAY_ID=prior;}
});

test('spare Demo enrollment checks fixture and synthetic gateway before POST, and preserves pending link',async()=>{
 const source=readFileSync(new URL('../src/app/api/admin/telematics/devices/route.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const gatewayId=randomUUID(),ownerOrganizationId=randomUUID(),actor={id:randomUUID(),role:'ADMIN',active:true};
 const body={mode:'DEMO',ownerOrganizationId,imei:'990000000000013'};
 let ownerAllowed=true,gatewayAllowed=true,linked=null,linkFails=false;const calls=[];
 const ports={
  '@/lib/auth':{getCurrentUser:async()=>actor},
  '@/lib/telematics.js':{
   assertAdminDemoFixtureBinding:async()=>{calls.push('fixture');if(!ownerAllowed)throw Error('DEMO_FIXTURE_UNAVAILABLE');return {label:'Demo GPS for Truck 02',registration:'CREATE'};},
   assertSyntheticGatewayAvailable:async()=>{calls.push('gateway');if(!gatewayAllowed)throw Error('DEMO_GATEWAY_UNAVAILABLE');},
   reconcileAdminProvisionedDevice:async()=>{calls.push('reconcile');return linked;},
   adminProvisionDevice:async(_user,command)=>{calls.push('link');assert.equal(command.imei,body.imei);assert.equal(command.synthetic,true);if(linkFails)throw Error('APP_FAILED');return {id:randomUUID()};},
  },
  '@/lib/telematics-gateway-registration.js':{
   registerAdminSpareGatewayDevice:async id=>{calls.push('register');assert.equal(id,gatewayId);return 43;},
   readSyntheticGatewayDevice:async()=>{throw Error('UNEXPECTED_PRE_REGISTERED');},
  },
  '@/lib/mobile/server':{mobileBody:async()=>body,mobileJson:value=>value,mobileFailure:error=>({error:error.message}),MobileError:class extends Error{}},
  '@/lib/telematics-http':{telematicsFailure:error=>error},
  '@/lib/rate-limit.js':{checkRateLimit:async()=>({allowed:true})},
  '@/lib/telematics-admin-provision.js':{adminDemoIntake,adminDeviceProvisionCommand,adminDeviceRegistrationCommand},
 };
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in ports,`Unexpected import ${name}`);return ports[name];},exports);
 const prior=process.env.TELEMATICS_DEMO_GATEWAY_ID;process.env.TELEMATICS_DEMO_GATEWAY_ID=gatewayId;
 try{
  assert.equal((await exports.POST({})).ok,true);
  assert.deepEqual(calls,['fixture','gateway','register','reconcile','link']);
  calls.length=0;ownerAllowed=false;assert.equal((await exports.POST({})).error,'DEMO_FIXTURE_UNAVAILABLE');
  assert.deepEqual(calls,['fixture']);
  calls.length=0;ownerAllowed=true;gatewayAllowed=false;assert.equal((await exports.POST({})).error,'DEMO_GATEWAY_UNAVAILABLE');
  assert.deepEqual(calls,['fixture','gateway']);
  calls.length=0;gatewayAllowed=true;linked={id:randomUUID(),reused:true};assert.equal((await exports.POST({})).result.reused,true);
  assert.deepEqual(calls,['fixture','gateway','register','reconcile']);
  calls.length=0;linked=null;linkFails=true;assert.equal((await exports.POST({})).error,'GATEWAY_REGISTRATION_PENDING_LINK');
  assert.deepEqual(calls,['fixture','gateway','register','reconcile','link','reconcile']);
 }finally{if(prior===undefined)delete process.env.TELEMATICS_DEMO_GATEWAY_ID;else process.env.TELEMATICS_DEMO_GATEWAY_ID=prior;}
});
