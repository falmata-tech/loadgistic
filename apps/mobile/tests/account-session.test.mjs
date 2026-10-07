import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountController } from '../src/session/account-controller.ts';
import { ApiError } from '../src/api/response.ts';
const identity = (n = 1) => ({accessToken:`access-${n}`,refreshToken:`refresh-${n}`,expiresAt:20000,state:'ACTIVE',user:{id:`user-${n}`,name:'Test',email:'test@example.test',role:'DRIVER',organizationName:null,businessName:null},access:{granted:true,status:'ACTIVE'}});
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
function setup(overrides={}) {
 let stored='refresh-1'; const calls=[];
 const port={now:()=>100000,changed:()=>{},read:async()=>stored,write:async value=>{stored=value;},remove:async()=>{stored=null;},request:async(path,options)=>{calls.push({path,options});return identity(2);},...overrides};
 return {controller:createAccountController(port),calls,stored:()=>stored,port};
}
test('restore rotates saved credentials and concurrent refresh uses one request',async()=>{
 const pending=deferred();let requests=0;const h=setup({request:async()=>{requests++;return pending.promise;}});
 const a=h.controller.refresh(),b=h.controller.refresh();assert.equal(a,b);await Promise.resolve();assert.equal(requests,1);pending.resolve(identity(2));await a;
 assert.equal(h.stored(),'refresh-2');assert.equal(h.controller.snapshot().session.user.id,'user-2');
});
test('logout during refresh discards late credentials, revokes them and cannot auto-restore',async()=>{
 const pending=deferred(),revoked=[];const h=setup({request:async(path,options)=>{if(path.endsWith('/refresh'))return pending.promise;revoked.push(options.body.refreshToken);return {};}});
 const refresh=h.controller.refresh();await Promise.resolve();await h.controller.signOut();pending.resolve(identity(2));await refresh;
 assert.equal(h.controller.snapshot().session,null);assert.equal(h.stored(),null);assert.deepEqual(revoked,['refresh-2']);assert.equal(await h.controller.refresh(),null);
});
test('signout falls back to non-credential tombstone when deletion fails',async()=>{
 const h=setup({remove:async()=>{throw Error('locked');}});await h.controller.refresh();await h.controller.signOut();assert.equal(h.stored(),'');assert.equal(h.controller.snapshot().cleanupRequired,false);assert.equal(await h.controller.refresh(),null);
});
test('storage and network failures retain an explicit retry, never auto-restore',async()=>{
 let failing=false;const h=setup({remove:async()=>{if(failing)throw Error('locked');},write:async()=>{if(failing)throw Error('locked');},request:async(path)=>{if(path.endsWith('/logout')&&failing)throw Error('offline');return identity(2);}});
 await h.controller.refresh();failing=true;await h.controller.signOut();assert.equal(h.controller.snapshot().session,null);assert.equal(h.controller.snapshot().cleanupRequired,true);assert.equal(await h.controller.refresh(),null);
 await assert.rejects(h.controller.verifyCode('handoff','123456'),/Retry sign-out/);failing=false;await h.controller.signOut();assert.equal(h.controller.snapshot().cleanupRequired,false);await h.controller.verifyCode('handoff','123456');assert.ok(h.controller.snapshot().session);
});
test('failed secure storage cannot expose a new session and revokes issued access',async()=>{
 const revoked=[];const h=setup({write:async()=>{throw Error('full');},request:async(path,options)=>{if(path.endsWith('/logout'))revoked.push(options.body.refreshToken);return identity(2);}});
 await assert.rejects(h.controller.verifyCode('handoff','123456'),/securely save/);assert.equal(h.controller.snapshot().session,null);assert.deepEqual(revoked,['refresh-2']);
});
test('older sign-in and protected responses cannot override a newer account or signout',async()=>{
 const old=deferred(),data=deferred(),revoked=[];let logins=0;const h=setup({request:async(path,options)=>{if(path.endsWith('/verify'))return ++logins===1?old.promise:identity(3);if(path.endsWith('/logout')){revoked.push(options.body.refreshToken);return {};}return data.promise;}});
 const first=h.controller.verifyCode('a','123456');await h.controller.verifyCode('b','123456');old.resolve(identity(2));await first;assert.equal(h.controller.snapshot().session.user.id,'user-3');assert.equal(h.stored(),'refresh-3');assert.ok(revoked.includes('refresh-2'));
 const read=h.controller.request('/api/mobile/dashboard');await h.controller.signOut();data.resolve({private:true});await assert.rejects(read,/sign in again/i);assert.equal(h.controller.snapshot().session,null);
});
test('revoked access removes storage; plan restrictions do not sign out the member',async()=>{
 let failure;const h=setup({request:async(path)=>{if(path.endsWith('/refresh'))return identity(2);throw failure;}});await h.controller.refresh();
 failure=new ApiError(403,'PLAN_REQUIRED','Review plan');await assert.rejects(h.controller.request('/api/mobile/fleet'));assert.ok(h.controller.snapshot().session);
 failure=new ApiError(403,'ACCOUNT_UNAVAILABLE','Unavailable');await assert.rejects(h.controller.request('/api/mobile/dashboard'));assert.equal(h.controller.snapshot().session,null);assert.equal(h.stored(),null);
});
