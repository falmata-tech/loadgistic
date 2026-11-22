import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrackingSessionController} from '../src/session/tracking-session-controller.ts';
import {trackingAccessCode,trackingLinkToken,guestTrackingSession} from '../../../src/lib/tracking-sessions/client.ts';
import {trackingSessionApiPathAllowed} from '../../../src/lib/mobile/tracking-session-path.js';
const id='16000000-0000-4000-8000-000000000001',other='16000000-0000-4000-8000-000000000002',token='a'.repeat(43),code='ABCD-EF23',grant='private.payload';
const view=()=>({id,reference:'Local load',state:'PENDING_PROVIDER',revision:1,workspaceId:null,shipmentId:null,route:[{placeRef:'A',label:'A',coordinate:[38,9]},{placeRef:'B',label:'B',coordinate:[39,10]}],cargoSummary:'Local cargo',pickupDate:'',deliveryDate:'',capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false},links:[],tracking:null});
function setup(){let now=1800000000000;const calls=[];const access=()=>({ok:true,data:{session:view(),grant,expiresAt:new Date(now+300000).toISOString()}});const port={now:()=>now,changed(){},request:async(path,options)=>{calls.push({path,options});return path==='/api/tracking/access'&&options?.body?access():{ok:true,data:view()};}};const controller=createTrackingSessionController(port);return {controller,port,calls,access,advance:ms=>now+=ms};}
test('both bounded credentials are required; URI credentials cannot smuggle code or another origin',()=>{
 assert.equal(trackingLinkToken(`https://loadgistic.com/track/${token}`),token);assert.equal(trackingAccessCode('abcd-ef23'),'ABCDEF23');
 for(const input of [`https://evil.test/track/${token}`,`https://loadgistic.com/track/${token}?code=${code}`,`https://user:password@loadgistic.com/track/${token}`,`//evil.test/track/${token}`,`/track/${token}#code=ABCD`])assert.equal(trackingLinkToken(input),null);
 for(const input of ['123456','IIII-OOOO','ABCD--EF23','ABCD EF23',null])assert.equal(trackingAccessCode(input),null);
});
test('guest uses one memory-only load with a dedicated header and no email list or mutation capability',async()=>{
 const x=setup();await x.controller.open(`https://loadgistic.com/track/${token}`,code);
 assert.deepEqual(x.calls[0],{path:'/api/tracking/access',options:{body:{linkToken:token,code:'ABCDEF23'}}});
 assert.equal(x.controller.snapshot().sessionId,id);for(const secret of [token,code,grant])assert.equal(JSON.stringify(x.controller.snapshot()).includes(secret),false);
 await x.controller.read(id);assert.deepEqual(x.calls[1],{path:`/api/tracking/sessions/${id}`,options:{trackingGrant:grant,signal:undefined}});
 const count=x.calls.length;await assert.rejects(x.controller.read(other));assert.equal(x.calls.length,count);
 assert.equal(Object.hasOwn(x.controller,'verify'),false);assert.equal(Object.hasOwn(x.controller,'review'),false);
});
test('absolute five-minute access expires without refresh or user activity extending it',async()=>{
 const x=setup();await x.controller.open(token,code);x.advance(299999);await x.controller.read(id);assert.equal(x.controller.snapshot().sessionId,id);x.advance(1);x.controller.expire();assert.equal(x.controller.snapshot().session,null);assert.equal(x.controller.snapshot().sessionId,null);await assert.rejects(x.controller.read(id));assert.equal(x.calls.filter(call=>call.path==='/api/tracking/access'&&call.options?.body).length,1);
});
test('logout and background discard late reads; resume performs fresh authorization before display',async()=>{
 const x=setup();await x.controller.open(token,code);let resolve;x.port.request=(path,options)=>options?.method==='DELETE'?Promise.resolve({ok:true}):new Promise(done=>{resolve=()=>done({ok:true,data:view()});});const reading=x.controller.read(id);await x.controller.clear();resolve();await assert.rejects(reading);assert.equal(x.controller.snapshot().session,null);
 const y=setup();await y.controller.open(token,code);y.controller.setForeground(false);assert.equal(y.controller.snapshot().session,null);let resume;y.port.request=()=>new Promise(done=>resume=done);y.controller.setForeground(true);assert.equal(y.controller.snapshot().session,null);resume({ok:true,data:view()});await new Promise(done=>setImmediate(done));assert.equal(y.controller.snapshot().session.id,id);
});
test('a late unlock cannot restore a closed or replaced session',async()=>{
 const x=setup();let finish;x.port.request=()=>new Promise(done=>finish=done);const opening=x.controller.open(token,code);while(!finish)await new Promise(done=>setImmediate(done));await x.controller.clear();finish(x.access());await opening;assert.equal(x.controller.snapshot().session,null);
});
test('current in-memory access binds the exact link and clears that binding on logout or expiry',async()=>{
 const x=setup();assert.equal(x.controller.matchesLink(token),false);await x.controller.open(token,code);assert.equal(x.controller.matchesLink(token),true);assert.equal(x.controller.matchesLink('b'.repeat(43)),false);
 for(const secret of[token,code,grant])assert.equal(JSON.stringify(x.controller.snapshot()).includes(secret),false);
 await x.controller.clear();assert.equal(x.controller.matchesLink(token),false);await x.controller.open(token,code);x.advance(300000);assert.equal(x.controller.matchesLink(token),false);
});
test('revocation clears private data; pending or guest manager fields are refused before rendering',async()=>{
 for(const status of[401,403,404,410]){const x=setup();await x.controller.open(token,code);x.port.request=async(path,options)=>{if(options?.method==='DELETE')return {ok:true};throw Object.assign(Error('Denied'),{status});};await assert.rejects(x.controller.read(id));assert.equal(x.controller.snapshot().session,null);assert.equal(x.controller.snapshot().sessionId,null);assert.equal(x.controller.matchesLink(token),false);}
 for(const change of [{workspaceId:other},{capabilities:{canIssueLink:true,canRevokeLink:false,canAcceptProvider:false}},{links:[{id:other,createdAt:'',expiresAt:'',revokedAt:null,allowLocation:true}]},{id:other}])assert.throws(()=>guestTrackingSession({...view(),...change},id));
});
test('shared native/preview transport admits only exact methods, IDs and bounded manager/proof parameters',()=>{
 for(const [path,method]of [['/api/tracking/access','POST'],['/api/tracking/access','DELETE'],[`/api/tracking/sessions/${id}`,'GET'],[`/api/tracking/sessions/${id}?view=manager&workspaceId=${other}`,'GET'],[`/api/tracking/sessions/${id}/proof/${other}?format=base64`,'GET'],[`/api/tracking/sessions/${id}/links?linkId=${other}`,'DELETE']])assert.equal(trackingSessionApiPathAllowed(path,method),true,path);
 for(const [path,method]of [['/api/tracking/otp','POST'],['/api/tracking/sessions','DELETE'],[`/api/tracking/sessions/${id}?view=guest`,'GET'],[`/api/tracking/sessions/${id}/proof/${other}?token=private`,'GET'],[`/api/tracking/sessions/${id}/links?linkId=${other}`,'POST'],[`/api/tracking/sessions/${id}/../../secrets`,'GET'],[`/api/tracking/sessions/${id}?workspaceId=${other}&workspaceId=${other}`,'GET']])assert.equal(trackingSessionApiPathAllowed(path,method),false,path);
});

test('explicit development extracts only maintained loopback links and production still rejects them',()=>{
 for(const host of ['127.0.0.1','localhost'])for(const port of ['3100','3101','8084']){const link=`http://${host}:${port}/track/${token}`;assert.equal(trackingLinkToken(link,true),token);assert.equal(trackingLinkToken(link),null);assert.equal(trackingLinkToken(link,false),null);}
 for(const link of [`http://localhost:9999/track/${token}`,`http://localhost.evil.test:3101/track/${token}`,`http://127.0.0.2:3101/track/${token}`,`https://localhost:3101/track/${token}`,`http://user:password@localhost:3101/track/${token}`,`http://localhost:3101/track/${token}?code=ABCD-EF23`,`http://localhost:3101/track/${token}#private`])assert.equal(trackingLinkToken(link,true),null);
});
test('native shipment reference search accepts only the exact POST without URL parameters',()=>{
 const path='/api/tracking/sessions/search';
 assert.equal(trackingSessionApiPathAllowed(path,'POST'),true);
 for(const method of ['GET','HEAD','DELETE'])assert.equal(trackingSessionApiPathAllowed(path,method),false);
 assert.equal(trackingSessionApiPathAllowed(path+'?reference=example','POST'),false);
 assert.equal(trackingSessionApiPathAllowed(path+'/extra','POST'),false);
});

test('native normal review is an exact authenticated POST path without query or guest-header variants',()=>{
 const path=`/api/tracking/sessions/${id}/review`;
 assert.equal(trackingSessionApiPathAllowed(path,'POST'),true);
 for(const [value,method]of [[path,'GET'],[path,'DELETE'],[`${path}?workspaceId=${other}`,'POST'],[`${path}?trackingGrant=private`,'POST'],[`/api/tracking/sessions/not-an-id/review`,'POST']])assert.equal(trackingSessionApiPathAllowed(value,method),false);
});

test('guest policy rejects pending connected facts and any proof marker before the shared view renders',()=>{
 const connected={...view(),state:'CONNECTED',shipmentId:other,tracking:{shipmentId:other,code:'Reference',status:'LOADING',updatedAt:'',trackingMode:'STATUS_ONLY',location:null,events:[]}};
 assert.equal(guestTrackingSession(connected).tracking.shipmentId,other);
 assert.throws(()=>guestTrackingSession({...view(),shipmentId:other}));
 assert.throws(()=>guestTrackingSession({...connected,tracking:{...connected.tracking,shipmentId:id}}));
 assert.throws(()=>guestTrackingSession({...connected,tracking:{...connected.tracking,events:[{id,status:'LOADING',createdAt:'',note:'',hasProof:true}]}}));
 assert.throws(()=>guestTrackingSession({...connected,tracking:{...connected.tracking,review:{rating:5,note:'Private account review'}}}));
});
