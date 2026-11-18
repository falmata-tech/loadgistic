import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFleetDeviceWorkspace,readFleetDeviceWorkspace,parseDriverLocationSelection} from '../src/lib/telematics-workspace.ts';
const id='00000000-0000-4000-8000-000000000001',stamp='2026-10-15T12:00:00Z';
const device={id,label:'Owner GPS',imei:'990000000000001',protocol:'gt06',protocolDeviceId:'990000000000001',gatewayDeviceId:1,modelProfile:'UNVERIFIED',synthetic:false,active:true,revision:stamp,vehicleId:null,lastSeenAt:stamp,connection:'ONLINE',capabilities:[],position:{latitude:9,longitude:38,speedKph:0,course:null,ignition:false,battery:90,observedAt:stamp,receivedAt:stamp}};
const workspace=()=>({canManage:true,page:1,pageSize:20,total:1,pageCount:1,devices:[structuredClone(device)],vehicles:[{id,label:'Truck',selection:{source:'GPS',deviceId:id,revision:stamp,precisionKm:20,selectedAt:stamp},published:{source:'MOBILE',updatedAt:stamp}}],commands:[]});
test('typed client keeps requested and published source distinct and strips extra server fields',()=>{
 const value=workspace();value.devices[0].secret='must not survive';value.adminToken='must not survive';
 const result=parseFleetDeviceWorkspace(value);
 assert.equal(result.vehicles[0].selection.source,'GPS');assert.equal(result.vehicles[0].published.source,'MOBILE');
 assert.equal(result.adminToken,undefined);assert.equal(result.devices[0].secret,undefined);
});
test('malformed, unbounded and unauthorized device payloads fail before rendering',()=>{
 for(const mutate of [v=>v.canManage=false,v=>v.devices[0].position.latitude=91,v=>v.devices[0].position.speedKph=-1,v=>v.vehicles[0].selection.source='INFERRED',v=>v.vehicles[0].selection.precisionKm=0,v=>v.devices=Array(21).fill(device),v=>v.devices[0].revision='not a timestamp']){
  const input=workspace();mutate(input);assert.equal(readFleetDeviceWorkspace(input),null);
 }
});
test('unknown command capability is never offered to an owner',()=>{
 const input=workspace();input.devices[0].capabilities=['RAW_COMMAND','DELETE_CUSTOMER'];
 assert.deepEqual(parseFleetDeviceWorkspace(input).devices[0].capabilities,[]);
});
test('retired wire selections become unselected without a point or permission override',()=>{
 for(const retired of ['MANUAL','MANUAL_ADMIN']){
  const input=workspace(),selection=input.vehicles[0].selection;
  Object.assign(selection,{source:retired,manualPoint:{latitude:40.015,longitude:-105.27,secret:'private'},driverSelectedManual:true});
  const result=parseFleetDeviceWorkspace(input).vehicles[0];
  assert.deepEqual(result.selection,{source:null,deviceId:id,revision:stamp,precisionKm:20,selectedAt:stamp,canChangeLocationSource:false});
  assert.equal(JSON.stringify(result).includes('private'),false);assert.equal('manualPoint' in result.selection,false);assert.equal('driverSelectedManual' in result.selection,false);
 }
 const input=workspace();input.vehicles[0].selection.manualPoint={latitude:9,longitude:38};assert.equal(readFleetDeviceWorkspace(input),null);
 for(const value of ['false',null,1]){const malformed=workspace();malformed.vehicles[0].selection.canChangeLocationSource=value;assert.equal(readFleetDeviceWorkspace(malformed),null);}
});
test('driver selection preserves real revisions and capabilities while rejecting malformed new contracts',()=>{
 const input={vehicleId:id,source:'MANUAL',manualPoint:{latitude:9,longitude:38},precisionKm:5,revision:stamp,canSetPhoneLocation:true};
 assert.deepEqual(parseDriverLocationSelection(input,id),{vehicleId:id,source:null,precisionKm:5,revision:stamp,canSetPhoneLocation:true,canChangeLocationSource:true});
 assert.equal(parseDriverLocationSelection({...input,source:null,manualPoint:null,canChangeLocationSource:false},id).canChangeLocationSource,false);
 for(const change of [{source:'INFERRED'},{source:'GPS'},{precisionKm:'5'},{precisionKm:0},{revision:'bad'},{vehicleId:'foreign'},{canSetPhoneLocation:'true'},{canChangeLocationSource:'false'}])assert.throws(()=>parseDriverLocationSelection({...input,...change},id),/Location details changed/);
});

test('private phone source summary preserves actual nullable observations without hardware capabilities',()=>{
 const value=workspace();value.vehicles[0].phone={installationId:id,connected:true,lastObservedAt:stamp,expiresAt:stamp,accuracyMeters:25,speedKph:36,headingDegrees:90,secret:'PRIVATE_SECRET',imei:'PRIVATE_IMEI',ignition:true};
 let result=parseFleetDeviceWorkspace(value).vehicles[0].phone;
 assert.deepEqual(result,{installationId:id,connected:true,lastObservedAt:stamp,expiresAt:stamp,accuracyMeters:25,speedKph:36,headingDegrees:90});
 assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);assert.equal('ignition' in result,false);
 value.vehicles[0].phone.speedKph=null;value.vehicles[0].phone.headingDegrees=null;result=parseFleetDeviceWorkspace(value).vehicles[0].phone;assert.equal(result.speedKph,null);assert.equal(result.headingDegrees,null);
 for(const [key,bad] of [['speedKph',-1],['accuracyMeters',Infinity],['headingDegrees',360],['installationId','bad']]){
  const changed=structuredClone(value);changed.vehicles[0].phone[key]=bad;assert.equal(readFleetDeviceWorkspace(changed),null);
 }
});
