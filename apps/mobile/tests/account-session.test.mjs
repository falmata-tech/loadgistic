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
test('permission return keeps a valid actor without rotating tokens; explicit reload still refreshes',async()=>{
 let rotations=0;const h=setup({request:async()=>identity(++rotations)});
 await h.controller.refresh();const active=h.controller.snapshot().session;
 assert.equal(await h.controller.resume(),active);assert.equal(await h.controller.resume(),active);assert.equal(rotations,1);
 await h.controller.refresh();assert.equal(rotations,2);assert.equal(h.controller.snapshot().session.user.id,'user-2');
});
test('resume near expiry shares one refresh and cannot return a signed-out actor',async()=>{
 const pending=deferred();let now=100000,rotations=0;const h=setup({now:()=>now,request:async(path)=>path.endsWith('/logout')?{}:++rotations===1?identity(1):pending.promise});
 await h.controller.refresh();now=20000000-30000;
 const first=h.controller.resume(),second=h.controller.resume();assert.equal(first,second);assert.equal(rotations,2);
 await h.controller.signOut();pending.resolve(identity(2));assert.equal(await first,null);assert.equal(h.controller.snapshot().session,null);assert.equal(h.stored(),null);
});
test('transient refresh failures retain only the unexpired actor and recover with a rotated token',async()=>{
 let failure=null,rotations=0;const h=setup({request:async(path)=>{if(path.endsWith('/refresh')){if(failure)throw failure;return identity(++rotations);}return {authorized:true};}});
 await h.controller.refresh();const active=h.controller.snapshot().session;
 for(const status of [0,408,429,500,502,503,504]){
  failure=new ApiError(status,status===0?'REQUEST_TIMEOUT':'SERVICE_UNAVAILABLE','Please try again.');
  assert.equal(await h.controller.refresh(),active);assert.equal(h.controller.snapshot().session,active);assert.equal(h.stored(),'refresh-1');assert.equal(h.controller.snapshot().error,'Please try again.');
  assert.deepEqual(await h.controller.request('/api/mobile/dashboard'),{authorized:true});
 }
 failure=null;await h.controller.refresh();assert.equal(h.controller.snapshot().session.user.id,'user-2');assert.equal(h.stored(),'refresh-2');assert.equal(h.controller.snapshot().error,'');
});
test('an actor expiring during a transient refresh cannot authorize a protected request',async()=>{
 let now=100000,rotations=0;const h=setup({now:()=>now,request:async()=>{if(++rotations===1)return identity(1);now=20000001;throw new ApiError(0,'REQUEST_TIMEOUT','Please try again.');}});
 await h.controller.refresh();now=20000000-30000;
 await assert.rejects(h.controller.request('/api/mobile/dashboard'),error=>error instanceof ApiError&&error.status===401);
 assert.equal(h.controller.snapshot().session,null);assert.equal(h.stored(),'refresh-1');assert.equal(rotations,2);
});
test('authority denial never uses an otherwise valid session as a refresh fallback',async()=>{
 for(const status of [401,403]){
  let denied=false,requests=0;const h=setup({request:async()=>{requests++;if(denied)throw new ApiError(status,'ACCOUNT_UNAVAILABLE','Please sign in again.');return identity(1);}});
  await h.controller.refresh();denied=true;assert.equal(await h.controller.refresh(),null);assert.equal(h.controller.snapshot().session,null);assert.equal(h.stored(),null);
  assert.equal(await h.controller.resume(),null);assert.equal(requests,2);
 }
});
test('an invalid refresh response or failed secure save cannot preserve a prior actor',async()=>{
 for(const failure of ['invalid','storage']){
  let next=false;const h=setup({write:async value=>{if(next&&failure==='storage')throw Error('locked');h.port.saved=value;},request:async(path)=>path.endsWith('/logout')?{}:next&&failure==='invalid'?{...identity(2),user:{...identity(2).user,role:'ADMIN'}}:identity(next?2:1)});
  await h.controller.refresh();assert.ok(h.controller.snapshot().session);next=true;assert.equal(await h.controller.refresh(),null);assert.equal(h.controller.snapshot().session,null);
 }
});
test('a late transient failure after account replacement cannot restore the old actor or set its error',async()=>{
 const old=deferred();let rotations=0;const h=setup({request:async(path)=>path.endsWith('/verify')?identity(3):++rotations===1?identity(1):old.promise});
 await h.controller.refresh();const refresh=h.controller.refresh();await h.controller.verifyCode('new-handoff','123456');old.reject(new ApiError(0,'REQUEST_TIMEOUT','Old error'));
 assert.equal(await refresh,null);assert.equal(h.controller.snapshot().session.user.id,'user-3');assert.equal(h.controller.snapshot().error,'');assert.equal(h.stored(),'refresh-3');
});
test('late timeout after sign-out cannot restore a retained actor or restart token refresh',async()=>{
 const old=deferred();let rotations=0;const h=setup({request:async(path)=>path.endsWith('/logout')?{}:++rotations===1?identity(1):old.promise});
 await h.controller.refresh();const refresh=h.controller.refresh();await h.controller.signOut();old.reject(new ApiError(0,'REQUEST_TIMEOUT','Old error'));
 assert.equal(await refresh,null);assert.equal(h.controller.snapshot().session,null);assert.equal(h.stored(),null);assert.equal(await h.controller.resume(),null);assert.equal(rotations,2);
});
