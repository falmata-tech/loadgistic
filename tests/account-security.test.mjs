import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAccountSecurityRequest,accountSecurityHandoff,readAccountSecurityHandoff,accountSecurityIdentity} from '../src/lib/account-security.js';
const actor='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
test('email change normalizes input without accepting privilege or identity fields',()=>{
 assert.deepEqual(parseAccountSecurityRequest({action:'EMAIL',email:' New@Example.test '}),{action:'EMAIL',email:'new@example.test'});
 for(const input of [{action:'EMAIL',email:'invalid'},{action:'EMAIL',email:'new@example.test',actorId:other},{action:'EMAIL',email:'new@example.test',role:'ADMIN'},null])assert.throws(()=>parseAccountSecurityRequest(input),/INVALID_ACCOUNT_SECURITY/);
});
test('deactivation requires a literal explicit confirmation',()=>{
 assert.deepEqual(parseAccountSecurityRequest({action:'DEACTIVATE',confirm:'DEACTIVATE'}),{action:'DEACTIVATE',confirm:'DEACTIVATE'});
 for(const input of [{action:'DEACTIVATE'},{action:'DEACTIVATE',confirm:true},{action:'DELETE',confirm:'DEACTIVATE'}])assert.throws(()=>parseAccountSecurityRequest(input),/INVALID_ACCOUNT_SECURITY/);
});
test('account security handoff binds the exact actor, operation, target and phase',()=>{
 const token=accountSecurityHandoff(actor,'EMAIL','new@example.test');
 assert.equal(readAccountSecurityHandoff(token,actor,'EMAIL','new@example.test'),true);
 assert.equal(readAccountSecurityHandoff(token,other,'EMAIL','new@example.test'),false);
 assert.equal(readAccountSecurityHandoff(token,actor,'DEACTIVATE','new@example.test'),false);
 assert.equal(readAccountSecurityHandoff(token,actor,'EMAIL','attacker@example.test'),false);
 assert.equal(readAccountSecurityHandoff(token,actor,'EMAIL','new@example.test','EMAIL_PENDING'),false);
 assert.equal(accountSecurityIdentity(token).actorId,actor);
 assert.doesNotMatch(Buffer.from(token.split('.')[0],'base64url').toString(),/new@example/);
});
test('forged or unsigned account handoffs never authorize a mutation',()=>{
 const token=accountSecurityHandoff(actor,'DEACTIVATE','DEACTIVATE');
 assert.equal(readAccountSecurityHandoff(token+'tampered',actor,'DEACTIVATE','DEACTIVATE'),false);
 assert.equal(accountSecurityIdentity('forged'),null);
 assert.equal(accountSecurityIdentity(undefined),null);
 const replacement=Buffer.from(JSON.stringify({sub:`account-security:${other}:DEACTIVATE:CURRENT_EMAIL:fake`,exp:9999999999})).toString('base64url');
 assert.equal(accountSecurityIdentity(replacement+'.'+token.split('.')[1]),null);
});
