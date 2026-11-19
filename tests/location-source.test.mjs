import test from 'node:test';
import assert from 'node:assert/strict';
import {locationSourceKind,locationSourceLabel,locationSourceColor,locationSourceSvg} from '../src/lib/location-source.js';
test('published provenance distinguishes GPS and driver phone without relabeling retired sources',()=>{
  assert.equal(locationSourceKind('TELEMATICS'),'GPS');
  assert.equal(locationSourceKind('DEVICE_OBSCURED'),'MOBILE');
  for(const retired of ['MANUAL','MANUAL_ADMIN']){assert.equal(locationSourceKind(retired),null);assert.equal(locationSourceLabel(retired),'');assert.equal(locationSourceSvg(retired),'');}
  assert.equal(locationSourceColor('GPS'),locationSourceColor('MOBILE'));
  assert.notEqual(locationSourceLabel('GPS'),locationSourceLabel('MOBILE'));
  assert.notEqual(locationSourceSvg('GPS'),locationSourceSvg('MOBILE'));
});
test('unknown or requested sources do not invent a verified GPS origin or markup',()=>{
  for(const value of [null,undefined,'PRESERVE_DRIVER','GPS_PENDING','',{},'<img onerror=alert(1)>']){
    assert.equal(locationSourceKind(value),null);
    assert.equal(locationSourceLabel(value),'');
    assert.equal(locationSourceSvg(value),'');
  }
});
