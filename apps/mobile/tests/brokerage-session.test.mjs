import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrokerageController,parseSavedChat,validateIntake} from '../src/session/brokerage-controller.ts';
const now=1000000,id='00000000-0000-4000-8000-000000000001',messageId='00000000-0000-4000-8000-000000000002',intake={name:'Guest',phone:'+251900000001',origin:'Adama',destination:'Dire Dawa'};
const snapshot=(messages=[],ended=false)=>({request:{id,origin:'Adama',destination:'Dire Dawa',status:'NEW',assignedName:null,endedAt:ended?'2026-10-05T00:00:00Z':null,expiresAt:new Date(now+600000).toISOString()},messages,hasOlder:false});
const response=()=>({token:'signed.capability',issuedAt:now,expiresAt:new Date(now+600000).toISOString(),snapshot:snapshot()});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function setup(overrides={}){let stored=null,uuids=0;const calls=[];const port={now:()=>now,uuid:()=>++uuids===1?id:messageId,secret:async()=>'a'.repeat(64),read:async()=>stored,write:async value=>{stored=value;},remove:async()=>{stored=null;},changed:()=>{},request:async(path,options)=>{calls.push({path,options});return path.endsWith('/start')?response():snapshot();},...overrides};const controller=createBrokerageController(port);controller.setVisible(true);return{controller,stored:()=>stored,calls,port};}
test('private intake is saved before create; lost start response retries the identical request',async()=>{
 let first=true,stored=null;const requests=[];const h=setup({write:async value=>{stored=value;},request:async(path,options)=>{assert.equal(JSON.parse(stored).kind,'DRAFT');requests.push(options.body);if(first){first=false;throw Error('timeout');}return response();}});
 await h.controller.start(intake);assert.equal(h.controller.snapshot().saved.kind,'DRAFT');await h.controller.start({...intake,origin:'Changed draft'});assert.deepEqual(requests[0],requests[1]);assert.equal(h.controller.snapshot().saved.kind,'ACTIVE');assert.equal(JSON.parse(stored).secret,undefined);assert.equal(JSON.parse(stored).intake,undefined);
});
test('storage failure blocks first mutation; active persistence failure keeps a recoverable original draft',async()=>{
 let writes=0,requests=0;const h=setup({write:async()=>{if(++writes>1)throw Error('storage failed');},request:async()=>{requests++;return response();}});await h.controller.start(intake);assert.equal(h.controller.snapshot().saved.kind,'DRAFT');assert.equal(requests,1);await h.controller.start(intake);assert.equal(h.controller.snapshot().saved.requestId,id);assert.equal(requests,2);
 const blocked=setup({write:async()=>{throw Error('storage failed');}});await blocked.controller.start(intake);assert.equal(blocked.calls.length,0);assert.equal(blocked.controller.snapshot().chat,null);
});
test('message retry retains exactly one id and body across uncertainty and restart',async()=>{
 let first=true;const sent=[];const h=setup({request:async(path,options)=>{if(path.endsWith('/start'))return response();if(!options.body)return snapshot();sent.push(options.body);if(first){first=false;throw Error('timeout');}return snapshot();}});await h.controller.start(intake);await h.controller.send('Original');assert.equal(h.controller.snapshot().saved.pending.body,'Original');const restored=createBrokerageController(h.port);restored.setVisible(true);await restored.restore();await restored.send('Changed');assert.deepEqual(sent[0],sent[1]);assert.equal(sent[0].messageId,messageId);assert.equal(restored.snapshot().saved.pending,undefined);
});
test('background hides chat; a late read after clear cannot restore conversation',async()=>{
 const pending=deferred();const h=setup({request:async(path)=>path.endsWith('/start')?response():pending.promise});await h.controller.start(intake);const read=h.controller.refresh();h.controller.setVisible(false);assert.equal(h.controller.snapshot().chat,null);await h.controller.clear();pending.resolve(snapshot());await read;assert.equal(h.controller.snapshot().saved,null);assert.equal(h.controller.snapshot().chat,null);
});
test('end keeps phone follow-up open and permits an explicit new request',async()=>{
 const h=setup({request:async(path)=>path.endsWith('/start')?response():snapshot([],true)});await h.controller.start(intake);await h.controller.newChat();assert.equal(h.controller.snapshot().saved.kind,'ACTIVE');await h.controller.end();assert.equal(h.controller.snapshot().chat.request.status,'NEW');assert.ok(h.controller.snapshot().chat.request.endedAt);await h.controller.newChat();assert.equal(h.controller.snapshot().saved,null);assert.equal(h.stored(),null);
});
test('a late poll cannot undo a confirmed send or end, and polls pause during writes',async()=>{
 for(const action of ['SEND','END']){
  const poll=deferred(),write=deferred();let reads=0;
  const message={id:messageId,sequence:1,kind:'VISITOR',body:'Confirmed',createdAt:new Date(now).toISOString(),name:'You'};
  const h=setup({request:async(path,options)=>{
   if(path.endsWith('/start'))return response();
   if(options.body)return write.promise;
   reads++;return poll.promise;
  }});
  await h.controller.start(intake);const reading=h.controller.refresh();
  const writing=action==='SEND'?h.controller.send('Confirmed'):h.controller.end();
  const during=h.controller.refresh();assert.equal(reads,1);
  write.resolve(snapshot(action==='SEND'?[message]:[],action==='END'));await writing;
  poll.resolve(snapshot());await Promise.all([reading,during]);
  assert.equal(h.controller.snapshot().chat.messages.length,action==='SEND'?1:0);
  assert.equal(Boolean(h.controller.snapshot().chat.request.endedAt),action==='END');
 }
});
test('expired and malformed credentials never restore; invalid intake cannot start',async()=>{
 for(const value of [{kind:'ACTIVE',requestId:id,token:'signed.capability',validUntil:now-1},{kind:'ACTIVE',requestId:id,token:'bad',validUntil:now+10000},{kind:'DRAFT',requestId:id,secret:'short',validUntil:now+10000,intake}])assert.throws(()=>parseSavedChat(JSON.stringify(value),now));
 assert.throws(()=>validateIntake({...intake,phone:'not a number'}));const h=setup();await h.controller.start({...intake,name:''});assert.equal(h.calls.length,0);
});

test('definitively unavailable saved request can be replaced, uncertain draft cannot',async()=>{
 let denied=false;const h=setup({request:async()=>{if(denied)throw Object.assign(Error('Unavailable'),{status:403,code:'CHAT_UNAVAILABLE'});throw Error('timeout');}});
 await h.controller.start(intake);await h.controller.newChat();assert.equal(h.controller.snapshot().saved.kind,'DRAFT');denied=true;await h.controller.start(intake);assert.equal(h.controller.snapshot().saved,null);assert.match(h.controller.snapshot().error,/Start a new request/);
});
