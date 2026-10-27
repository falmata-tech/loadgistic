import test from 'node:test';
import assert from 'node:assert/strict';
import {
  privatePhotoFilterParams,privatePhotoFilterValues,privatePhotoDatabaseFilters
} from '../src/lib/business-capacity/photo-filter.js';

test('private photo filter normalizes presence and server-age choices',()=>{
 assert.deepEqual(privatePhotoFilterValues({}),{photoPresent:'',photoMaxAgeHours:''});
 assert.deepEqual(privatePhotoFilterValues({photoPresent:'false'}),{photoPresent:'',photoMaxAgeHours:''});
 assert.deepEqual(privatePhotoFilterValues({photoMaxAgeHours:'24'}),{photoPresent:'true',photoMaxAgeHours:'24'});
 assert.deepEqual(privatePhotoDatabaseFilters({photoMaxAgeHours:'72'}),
  {photo_present:true,photo_max_age_hours:72});
 assert.deepEqual(privatePhotoDatabaseFilters({photoPresent:'true'}),{photo_present:true});
});

test('private photo filter rejects duplicate, arbitrary, and unbounded choices',()=>{
 for(const query of ['photoPresent=true&photoPresent=false','photoMaxAgeHours=24&photoMaxAgeHours=72',
  'photoPresent=1','photoMaxAgeHours=0','photoMaxAgeHours=999999','photoMaxAgeHours=24.0']){
  assert.throws(()=>privatePhotoFilterParams(new URLSearchParams(query)),/INVALID_PRIVATE_PHOTO_FILTER/);
 }
 assert.throws(()=>privatePhotoDatabaseFilters({photoPresent:true}),/INVALID_PRIVATE_PHOTO_FILTER/);
});
