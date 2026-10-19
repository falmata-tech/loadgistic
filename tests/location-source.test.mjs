import test from 'node:test';
import assert from 'node:assert/strict';
import {locationSourceKind,locationSourceLabel,locationSourceSvg} from '../src/lib/location-source.js';
test('published provenance distinguishes GPS, driver phone and manual entry',()=>{
  assert.equal(locationSourceKind('TELEMATICS'),'GPS');
  assert.equal(locationSourceKind('DEVICE_OBSCURED'),'MOBILE');
  assert.equal(locationSourceKind('MANUAL_ADMIN'),'MANUAL');
  assert.equal(locationSourceLabel('MANUAL_ADMIN'),'Manually entered');
  assert.notEqual(locationSourceSvg('GPS'),locationSourceSvg('MOBILE'));
});
test('unknown or requested sources do not invent a verified GPS origin or markup',()=>{
  for(const value of [null,undefined,'PRESERVE_DRIVER','GPS_PENDING','',{},'<img onerror=alert(1)>']){
    assert.equal(locationSourceKind(value),null);
    assert.equal(locationSourceLabel(value),'');
    assert.equal(locationSourceSvg(value),'');
  }
});
