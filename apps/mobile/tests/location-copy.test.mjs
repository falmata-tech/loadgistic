import test from 'node:test';
import assert from 'node:assert/strict';
import {locationAreaLabel} from '../src/localization/location-copy.ts';
import {nativeMessages} from '../src/localization/messages.ts';
test('location wording is translated while catalog labels and other text remain unchanged',()=>{
 for(const locale of ['am','om','so','ti']){
  const t=(key,values)=>nativeMessages[locale][key].replace('{place}',values.place);
  const label=locationAreaLabel('Around Adama, Ethiopia',t);
  assert.ok(label.includes('Adama, Ethiopia'));assert.notEqual(label,'Around Adama, Ethiopia');
  assert.equal(locationAreaLabel('Saved custom label',t),'Saved custom label');
 }
});
