import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeMessages} from '../apps/mobile/src/localization/messages.ts';

const keys=[
 'Add to this business','Add viewer','Business access is inactive.','Coordinate with your team',
 'Could not load this workspace. Please try again.','Could not save changes.',
 'Current viewers','Former team member',
 'Invitation saved, but email delivery failed. Use Resend.',
 'Loading sharing…','Loading your workspaces','No map or shipment access',
 'No viewers added.','Open My workspace to create or join a business.',
 'Permitted team members can see the route and status. Only staff you select can see vehicle location.',
 'Please sign in again.','Remove from business','Remove viewer',
 'Share tracking','Shipment owner',
 'Their permitted team members will no longer see this vehicle.',
 'This member will lose access to this business.',
 'Verify the shipment owner email to manage sharing.',
 'Viewer email','Viewer name',
 'Viewers can follow the route and shipment status. Vehicle location stays private.'
];

test('Tracking sharing and business account copy has both supported mobile translations',()=>{
 assert.equal(keys.length,26);
 for(const locale of ['am','om']){
  const messages=nativeMessages[locale];
  for(const key of keys){
   assert.ok(typeof messages[key]==='string'&&messages[key].trim(),`${locale}: ${key}`);
   assert.notEqual(messages[key],key,`${locale}: ${key}`);
   assert.doesNotMatch(messages[key],/\b(?:ATTACH_BUSINESS|BUSINESS_WORKSPACE|REMOVE_LOCATION|ALLOW_LOCATION)\b/,`${locale}: ${key}`);
  }
 }
});
