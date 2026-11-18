import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileBearer, mobileAccountState, mobileIdentity } from '../src/lib/mobile/identity-policy.js';
const user = { id: 'one', name: 'Provider', email: 'provider@example.test', active: true, role: 'TRANSPORTER' };
test('native bearer parsing never treats cookies, malformed headers or giant input as credentials', () => {
 for (const value of [null, '', 'cookie=value', 'Bearer abc', 'Bearer a.b.c extra', 'Bearer '+ 'a'.repeat(9000)]) assert.equal(mobileBearer(value), null);
 assert.equal(mobileBearer('Bearer a.b.c'), 'a.b.c');
});
test('mobile workspace is denied to staff, mismatched and inactive identities', () => {
 assert.equal(mobileAccountState(user, 'two'), 'DENIED');
 assert.equal(mobileAccountState(null, 'one'), 'DENIED');
 for (const role of ['ADMIN', 'SUPPORT']) assert.equal(mobileAccountState({ ...user, role }, 'one', { canSignUp: true }), 'WEB_ONLY');
 assert.equal(mobileAccountState({ ...user, active: false }, 'one'), 'DENIED');
 assert.equal(mobileAccountState({ ...user, role: 'UNKNOWN' }, 'one'), 'DENIED');
});
test('inactive signup and invitation are explicit states, never workspace access', () => {
 assert.equal(mobileAccountState({ ...user, active: false }, 'one', { canJoin: true }), 'JOIN_FLEET');
 assert.equal(mobileAccountState({ ...user, active: false }, 'one', { canSignUp: true }), 'ONBOARDING');
 for (const role of ['DRIVER', 'TRANSPORTER']) assert.equal(mobileAccountState({ ...user, role }, 'one'), 'ACTIVE');
});
test('native identity projection excludes platform permissions and unknown fields', () => {
 const result = mobileIdentity({ ...user, can_manage_billing: true, secret: 'must-not-leak' });
 assert.equal('secret' in result, false); assert.equal('can_manage_billing' in result, false);
});
test('personal registered shipment owners are active without inheriting business or provider authority',()=>{
 for(const role of ['SHIPPER','RECEIVER']){
  const owner={...user,role,platform_role:role,selected_business_workspace:null};
  assert.equal(mobileAccountState(owner,owner.id),'ACTIVE');
  const identity=mobileIdentity(owner);
  assert.equal(identity.role,role);assert.equal(identity.selectedBusinessWorkspace,null);
  assert.equal(identity.ownsProviderAccount,false);assert.equal(identity.canManageFleet,false);assert.equal(identity.drivesTruck,false);
  assert.equal(mobileAccountState({...owner,active:false},owner.id),'DENIED');
  assert.equal(mobileAccountState({...owner,platform_role:'ADMIN'},owner.id),'WEB_ONLY');
  assert.equal(mobileAccountState({...owner,platform_role:'TRANSPORTER'},owner.id),'DENIED');
  assert.equal(mobileAccountState({...owner,selected_business_workspace:{id:'forged'}},owner.id),'DENIED');
 }
 assert.equal(mobileAccountState({...user,role:'CUSTOMER',platform_role:'SHIPPER'},user.id),'DENIED');
});
