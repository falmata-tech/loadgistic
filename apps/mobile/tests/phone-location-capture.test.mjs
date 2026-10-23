import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {phoneObservation} from '../src/location/phone-observation.ts';
function fixture(){const events=[],proof={reportId:'synthetic-report',observedAt:1800000000000};
 const source=readFileSync(new URL('../src/location/capture.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,exports={};
 const ports={Location:{getForegroundPermissionsAsync:async()=>({granted:true}),requestForegroundPermissionsAsync:async()=>({granted:true}),Accuracy:{High:1},getCurrentPositionAsync:async()=>{events.push('captured');return{coords:{latitude:9,longitude:38,accuracy:25},timestamp:proof.observedAt};}},Platform:{OS:'android'},capacityLocation:()=>({approximateLat:9.01,approximateLng:38.01,locationPrecisionKm:10}),
  phoneObservation,authorizedForegroundCapture:async(port)=>{events.push('permission');return port.capture();},preparePhoneLocation:async()=>{events.push('registered');return{proof:at=>{assert.equal(at,proof.observedAt);return proof;}};}};
 new Function(...Object.keys(ports),'exports',compiled)(...Object.values(ports),exports);return{...exports,events,proof};
}
test('native truck capture enrolls before permission/capture and sends only obscured coordinates plus private attribution',async()=>{
 const f=fixture(),fix=await f.captureCapacityLocation(10);assert.deepEqual(f.events,['registered','permission','captured']);
 assert.deepEqual(fix,{approximateLat:9.01,approximateLng:38.01,locationPrecisionKm:10,phoneInstallation:f.proof});assert.equal('latitude' in fix,false);
});
test('nearby public search stays account-free and does not enroll a truck phone',async()=>{
 const f=fixture(),fix=await f.captureNearbyLocation(10);assert.deepEqual(f.events,['permission','captured']);assert.equal('phoneInstallation' in fix,false);
});
test('phone observations contain only real available OS fields and convert speed units',()=>{
 assert.deepEqual(phoneObservation({accuracy:25,speed:10,heading:90}),{accuracyMeters:25,speedKph:36,headingDegrees:90});
 assert.deepEqual(phoneObservation({accuracy:null,speed:-1,heading:-1}),{accuracyMeters:null,speedKph:null,headingDegrees:null});
 assert.deepEqual(phoneObservation({accuracy:Infinity,speed:100,heading:360}),{accuracyMeters:null,speedKph:null,headingDegrees:null});
 assert.deepEqual(phoneObservation({accuracy:0,speed:0,heading:0}),{accuracyMeters:0,speedKph:0,headingDegrees:0});
});
