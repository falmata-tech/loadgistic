import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeBackgroundLocation,backgroundDisclosureVersion,backgroundConsentKey} from '../src/location/background-consent.ts';
function fixture({stored=null,agree=true,foreground=false,background=false}={}) {
 const events=[];let current=true;
 const port={current:()=>current,read:async()=>{events.push('read');return stored;},write:async value=>{events.push('write');stored=value;},disclose:async()=>{events.push('disclose');return agree;},foreground:async()=>{events.push('foreground');return {granted:foreground};},background:async()=>{events.push('background');return {granted:background};},requestForeground:async()=>{events.push('requestForeground');return {granted:true};},requestBackground:async()=>{events.push('requestBackground');return {granted:true};}};
 return {port,events,stale:()=>{current=false;},stored:()=>stored};
}
test('polling with already granted OS permission never substitutes for consent',async()=>{
 const f=fixture({foreground:true,background:true});assert.equal(await authorizeBackgroundLocation(f.port),false);assert.deepEqual(f.events,['read']);
});
test('explicit disclosure acceptance is persisted before either permission request',async()=>{
 const f=fixture();assert.equal(await authorizeBackgroundLocation(f.port,true),true);assert.deepEqual(f.events,['read','disclose','write','foreground','requestForeground','background','requestBackground']);assert.equal(f.stored(),backgroundDisclosureVersion);
});
test('decline invokes neither storage write nor OS permission APIs',async()=>{
 const f=fixture({agree:false});assert.equal(await authorizeBackgroundLocation(f.port,true),false);assert.deepEqual(f.events,['read','disclose']);
});
test('stale actor/closed app cannot save consent or ask permission',async()=>{
 const f=fixture();f.port.disclose=async()=>{f.stale();return true;};assert.equal(await authorizeBackgroundLocation(f.port,true),false);assert.deepEqual(f.events,['read']);
});
test('revoked foreground permission leaves tracking unavailable without auto-prompt',async()=>{
 const f=fixture({stored:backgroundDisclosureVersion,background:true});assert.equal(await authorizeBackgroundLocation(f.port),false);assert.deepEqual(f.events,['read','foreground']);
});
test('a revoked or denied background permission cannot start tracking',async()=>{
 const f=fixture({stored:backgroundDisclosureVersion,foreground:true});f.port.requestBackground=async()=>({granted:false});assert.equal(await authorizeBackgroundLocation(f.port,true),false);
});
test('accepted current disclosure allows permission checks without another dialog',async()=>{
 const f=fixture({stored:backgroundDisclosureVersion,foreground:true,background:true});assert.equal(await authorizeBackgroundLocation(f.port),true);assert.deepEqual(f.events,['read','foreground','background']);assert.notEqual(backgroundConsentKey('first'),backgroundConsentKey('second'));
});
test('consent storage failure does not proceed to OS permission requests',async()=>{
 const f=fixture();f.port.write=async()=>{throw Error('storage');};await assert.rejects(authorizeBackgroundLocation(f.port,true),/storage/);assert.deepEqual(f.events,['read','disclose']);
});
