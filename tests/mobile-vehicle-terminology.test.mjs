import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeMessages} from '../apps/mobile/src/localization/messages.ts';

const keys=[
 'Vehicle', 'Vehicles', 'Vehicle type', 'Whole vehicle',
 'Vehicle filters', 'Vehicle location', 'Vehicle documents',
 'Add vehicle', 'My vehicle', 'Vehicles and drivers',
 'Vehicle details', 'Vehicle and assigned driver',
 'No matching available vehicles.',
 'Permitted team members can see the route and status. Only staff you select can see vehicle location.',
];

test('courier-inclusive vehicle labels are localized in marketplace and workspace',()=>{
 for(const locale of ['am','om']){
  const shared=JSON.parse(fs.readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  const messages={...shared,...nativeMessages[locale]};
  for(const key of keys){
   assert.ok(messages[key]?.trim(),`${locale}: ${key}`);
   assert.notEqual(messages[key],key,`${locale}: ${key}`);
  }
 }
});
