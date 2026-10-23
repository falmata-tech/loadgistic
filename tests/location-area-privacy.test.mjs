import {test} from 'node:test';
import assert from 'node:assert/strict';
import {obscureCoordinate} from '../src/lib/location-privacy.js';
import {distanceBetweenKm} from '../src/lib/domain.js';
test('nearby raw fixes map to one stable area instead of a known-distance offset',()=>{
 const input={lat:41.8781,lng:-87.6298};
 for(const radius of [1,3,5,10,20,40]){
  const center=obscureCoordinate(input.lat,input.lng,radius);
  const outputs=new Set(Array.from({length:21},(_,i)=>JSON.stringify(obscureCoordinate(input.lat+i*0.00000001,input.lng+i*0.00000001,radius))));
  assert.equal(outputs.size,1);assert.ok(distanceBetweenKm(input,center)<radius);
 }
});
test('area-center privacy bound holds at poles, date line and across world samples',()=>{
 let seed=42;
 const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const inputs=[[90,180],[-90,-180],[0,0],[89.99999,-179.99999],[-89.99999,179.99999]];
 for(let i=0;i<2000;i++)inputs.push([random()*180-90,random()*360-180]);
 for(const [lat,lng] of inputs)for(const radius of [1,3,5,10,20,40]){
  const point=obscureCoordinate(lat,lng,radius);assert.ok(point.lat>=-90&&point.lat<=90&&point.lng>=-180&&point.lng<=180);
  assert.ok(distanceBetweenKm({lat,lng},point)<=radius,`${lat}/${lng}/${radius}`);
 }
 assert.deepEqual(obscureCoordinate(10,180,20),obscureCoordinate(10,-180,20));
});
