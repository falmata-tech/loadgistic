import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPACITY_LOAD_CHOICES,capacityLoadPreference,capacityLoadLabel,capacityLoadExplanation} from '../src/lib/capacity-load-preferences.js';
import {obscureCoordinate,isValidCoordinate} from '../src/lib/location-privacy.js';
import {approximateLocationArea} from '../src/lib/approximate-location-area.js';
import {readFileSync} from 'node:fs';

test('Empty alone never means a full-truck load is accepted',()=>{
 for(const [full,shared,expected] of [[true,false,'FTL'],[false,true,'PTL'],[true,true,'BOTH'],[false,false,null],[undefined,undefined,null],['true','false',null]])
  assert.equal(capacityLoadPreference('EMPTY',full,shared),expected);
 assert.equal(capacityLoadPreference('PARTIAL',true,true),'PTL');
 assert.equal(capacityLoadPreference('PARTIAL',true,false),null);
 assert.equal(capacityLoadPreference('OFF_DUTY',true,true),null);
 assert.equal(capacityLoadLabel(null),null);
});
test('worldwide offsets preserve radius, valid coordinates and honest area labels',()=>{
 const places=[[41.8781,-87.6298],[-1.2921,36.8219],[25.2048,55.2708],[0,0],[0,179.9999],[0,-179.9999],[89.99,45],[-89.99,-45]];
 for(const [lat,lng] of places)for(const radius of [1,3,5,10,20,40]){
  const point=obscureCoordinate(lat,lng,radius);assert.ok(isValidCoordinate(point.lat,point.lng));
  const rad=Math.PI/180,a=Math.sin((point.lat-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(point.lat*rad)*Math.sin((point.lng-lng)*rad/2)**2;
  const distance=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
  assert.ok(distance<=radius+0.002,`${lat}/${lng}: ${distance} vs ${radius}`);
  assert.notDeepEqual(point,{lat,lng});
 }
 assert.equal(approximateLocationArea(41.8781,-87.6298),'Around current device area');
 assert.match(approximateLocationArea(9.03,38.74),/Ethiopia$/);
 for(const [lat,lng] of [[null,0],['',0],[91,0],[0,181],[NaN,0],[0,Infinity]]){
  assert.equal(isValidCoordinate(lat,lng),false);assert.throws(()=>obscureCoordinate(lat,lng,20));
 }
});
test('shipment wording keeps the same saved values and has both translations',()=>{
 assert.deepEqual(CAPACITY_LOAD_CHOICES,[['FTL','Full vehicle shipments only'],['PTL','Partial Shipments Only'],['BOTH','Partial or full vehicle shipments']]);
 for(const [preference,label] of CAPACITY_LOAD_CHOICES)assert.equal(capacityLoadLabel(preference),label);
 const keys=[...CAPACITY_LOAD_CHOICES.flatMap(([preference,label])=>[label,capacityLoadExplanation(preference)]),
  'Choose which shipments you accept.','Shipments accepted','Vehicle availability',
  'Whole vehicle','Partial shipment','The link and code open this shipment only.',
  '{count} partly loaded vehicles','Choose a shipment size and vehicle type.','Uses part of the vehicle',
  '{count} {status} trucks. Zoom in.','Your device returned an invalid location. Try again.','Approximate area'];
 for(const locale of ['am','om']){
  const catalog=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url)));
  for(const key of keys){assert.ok(catalog[key]?.trim(),`${locale}: ${key}`);assert.deepEqual([...catalog[key].matchAll(/\{\w+\}/g)].map(m=>m[0]).sort(),[...key.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort());}
 }
});
