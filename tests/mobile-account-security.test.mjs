import { closeNativeSession } from '../src/lib/mobile/logout.js';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeSecurityCommand, nativeSecurityHandoff, readNativeSecurityHandoff } from '../src/lib/mobile/account-security-contract.js';
import { accountSecurityHandoff } from '../src/lib/account-security.js';
import { createSessionToken } from '../src/lib/security.js';
const actor='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002', operation={action:'EMAIL',email:'next@example.test'};
test('native account changes strictly bind actor, target, action, phase and purpose',()=>{
 const token=nativeSecurityHandoff(actor,operation);
 assert.equal(readNativeSecurityHandoff(token,actor,operation),true);
 for(const [id,input,phase] of [[other,operation,'CURRENT_EMAIL'],[actor,{...operation,email:'other@example.test'},'CURRENT_EMAIL'],[actor,{action:'DEACTIVATE',confirm:'DEACTIVATE'},'CURRENT_EMAIL'],[actor,operation,'EMAIL_PENDING']])assert.equal(readNativeSecurityHandoff(token,id,input,phase),false);
 assert.equal(readNativeSecurityHandoff(accountSecurityHandoff(actor,'EMAIL',operation.email),actor,operation),false);
 assert.equal(readNativeSecurityHandoff(token+'.extra',actor,operation),false);
 assert.equal(readNativeSecurityHandoff(token+'x',actor,operation),false);
 const payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 assert.equal(readNativeSecurityHandoff(createSessionToken(payload.sub,-5),actor,operation),false);
 assert.equal(JSON.stringify(payload).includes(operation.email),false);
});
test('native security commands require explicit closure and code only at confirmation',()=>{
 assert.equal(nativeSecurityCommand.safeParse({step:'REQUEST',operation}).success,true);
 for(const value of [{step:'REQUEST',operation,code:'123456'},{step:'REQUEST',operation:{...operation,actorId:other}},{step:'CONFIRM',operation,handoff:'token',code:'x'},{step:'REQUEST',operation:{action:'DEACTIVATE'}},{step:'CHECK',operation:{action:'DEACTIVATE',confirm:'DEACTIVATE'},handoff:'token'}])assert.equal(nativeSecurityCommand.safeParse(value).success,false);
});

test('local account-security verification cannot silently auto-confirm email changes',()=>{
 const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
 const email=config.split('[auth.email]')[1].split('[')[0];
 assert.match(email,/enable_confirmations = true/);
 assert.match(email,/double_confirm_changes = true/);
});

test('native logout distinguishes a revoked credential from an unconfirmed network outcome',async()=>{
 for(const error of [{status:0,code:'fetch_failed'},{status:503,code:'unexpected_failure'},{status:400,code:'unknown'}])await assert.rejects(closeNativeSession({setSession:async()=>({error}),signOut:async()=>{throw Error('must not reach');}},{}),/LOGOUT_UNCONFIRMED/);
 await closeNativeSession({setSession:async()=>({error:{status:400,code:'refresh_token_not_found'}})},{});
 let scope;await closeNativeSession({setSession:async()=>({error:null}),signOut:async value=>{scope=value.scope;return {error:null};}},{});assert.equal(scope,'local');
 await assert.rejects(closeNativeSession({setSession:async()=>({error:null}),signOut:async()=>({error:Error('offline')})},{}),/LOGOUT_UNCONFIRMED/);
});

test('actual native logout revokes installation authority before closing the verified Auth session',async()=>{
 const events=[],session={access_token:'synthetic-session-token'};
 const auth={setSession:async()=>{events.push('authenticated');return{error:null,data:{session}};},signOut:async()=>{events.push('session closed');return{error:null};}};
 await closeNativeSession(auth,{},async value=>{assert.equal(value,session);events.push('device authority revoked');});
 assert.deepEqual(events,['authenticated','device authority revoked','session closed']);
 events.length=0;await assert.rejects(closeNativeSession(auth,{},async()=>{throw Error('revocation unavailable');}),/revocation unavailable/);
 assert.deepEqual(events,['authenticated'],'unconfirmed device revocation must not be silently treated as complete logout');
});
