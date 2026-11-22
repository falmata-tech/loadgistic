import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {createTrackingSessionCredentials,trackingSessionCredentialDigests,createSessionToken,providerTrackingRecipientDigest} from '../src/lib/security.js';
import {issueTrackingLinkGrant,parseTrackingLinkGrant,TRACKING_LINK_GRANT_COOKIE,TRACKING_LINK_GRANT_MS} from '../src/lib/tracking-sessions/grant.js';
import {trackingMapLocation} from '../src/lib/tracking-map.js';
import {mutationOriginAllowed} from '../src/lib/origin.js';
import {dateOnly} from '../src/lib/date-calendar.js';
import {privateFilePayload} from '../src/lib/mobile/file-contract.js';
import {privateDocumentHeaders} from '../src/lib/private-storage.js';

const id='00000000-0000-4000-8000-000000000001',workspace='00000000-0000-4000-8000-000000000002',actor='00000000-0000-4000-8000-000000000003',other='00000000-0000-4000-8000-000000000004';
const environment={NODE_ENV:'production',TRACKING_CODE_SECRET:'synthetic-tracking-code-key-abcdefghijklmnopqrstuvwxyz',SESSION_SECRET:'synthetic-distinct-session-key-abcdefghijklmnopqrstuvwxyz'};
const credentials=createTrackingSessionCredentials(environment),digest=(token,code)=>trackingSessionCredentialDigests(token,code,environment);
function compile(path,ports){
 const parsed=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,exports={};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);return exports;
}
const contracts=compile('src/lib/tracking-sessions/contracts.ts',{z,dateOnly});
const requestSchemas=compile('src/lib/tracking-sessions/requests.ts',{z,id:contracts.trackingSessionId});
const {trackingSessionService,TrackingSessionError}=compile('src/lib/tracking-sessions/supabase.ts',{
 z,...contracts,...requestSchemas,trackingMapLocation,createSupabaseAdminClient(){throw Error('Tests require an injected RPC port');}
});
const body=compile('src/lib/business-workspaces/http.ts',{});
const route=[{placeRef:'one',label:'Origin',coordinate:[38,9]},{placeRef:'two',label:'Via',coordinate:[39,10]},{placeRef:'three',label:'Destination',coordinate:[40,11]}];
const rawManager=()=>({id,revision:1,workspaceId:workspace,reference:'SYNTHETIC',state:'PENDING_PROVIDER',shipmentId:null,route,cargoSummary:'Synthetic cargo',pickupDate:'',deliveryDate:'',capabilities:{canIssueLink:true,canRevokeLink:true,canAcceptProvider:false},links:[],shipment:null});
const shipment=(shipmentId=other)=>({id:shipmentId,code:'SYNTHETIC-REFERENCE',operational_status:'LOADING',updated_at:new Date().toISOString(),tracking_mode:'LOCATION_AND_STATUS',can_view_location:true,current_location:{location_lat:9,location_lng:39,location_precision_km:20,location_area:'Approximate area',location_source:'DEVICE_OBSCURED',updated_at:new Date().toISOString()},events:[{id:actor,status:'LOADING',note:'Saved update',created_at:new Date().toISOString(),has_proof:true}]});
const rawGuest=()=>({...rawManager(),id,sessionId:id,expiresAt:new Date(Date.now()+600000).toISOString()});

test('Tracking link and code are independent random credentials with purpose-separated keyed digests',()=>{
 const second=createTrackingSessionCredentials(environment);
 assert.match(credentials.linkToken,/^[A-Za-z0-9_-]{43}$/);assert.match(credentials.code,/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
 assert.notEqual(second.linkToken,credentials.linkToken);assert.notEqual(second.code,credentials.code);
 assert.notEqual(credentials.linkDigest,credentials.codeDigest);
 assert.deepEqual(digest(credentials.linkToken,credentials.code.toLowerCase().replace('-','')),digest(credentials.linkToken,credentials.code));
 assert.deepEqual(trackingSessionCredentialDigests(credentials.linkToken,credentials.code,{...environment,SESSION_SECRET:'other-distinct-session-key-abcdefghijklmnopqrstuvwxyz'}),digest(credentials.linkToken,credentials.code));
 assert.notDeepEqual(trackingSessionCredentialDigests(credentials.linkToken,credentials.code,{...environment,TRACKING_CODE_SECRET:'other-tracking-code-key-abcdefghijklmnopqrstuvwxyz'}),digest(credentials.linkToken,credentials.code));
 assert.throws(()=>createTrackingSessionCredentials({...environment,TRACKING_CODE_SECRET:environment.SESSION_SECRET}),/TRACKING_CODE_SECRET_REQUIRED/);
 for(const [token,code]of[['short',credentials.code],[credentials.linkToken,'not-a-code'],[credentials.linkToken,'IIII-IIII']])assert.throws(()=>digest(token,code),/TRACKING_ACCESS_DENIED/);
});

test('Tracking grant is exact-session, signed, at most five minutes and bounded by link expiry',()=>{
 const now=Date.now(),expires=new Date(now+3600000).toISOString(),issued=issueTrackingLinkGrant(id,credentials,expires,now);
 assert.equal(Date.parse(issued.expiresAt),now+TRACKING_LINK_GRANT_MS);
 const grant=parseTrackingLinkGrant(issued.grant,now);
 assert.equal(grant.sessionId,id);assert.equal(grant.linkDigest,credentials.linkDigest);assert.equal(grant.codeDigest,credentials.codeDigest);
 assert.ok(grant.expiresAt<=now+TRACKING_LINK_GRANT_MS);assert.equal(parseTrackingLinkGrant(issued.grant,now+TRACKING_LINK_GRANT_MS),null);
 const short=issueTrackingLinkGrant(id,credentials,new Date(now+60000).toISOString(),now);
 assert.equal(parseTrackingLinkGrant(short.grant,now+60000),null);
 const delayedStart=now-1500,deadline=delayedStart+60000;
 const delayed=issueTrackingLinkGrant(id,credentials,new Date(deadline).toISOString(),delayedStart);
 assert.equal(parseTrackingLinkGrant(delayed.grant,deadline),null);
 const payload=Buffer.from(issued.grant.split('.')[0],'base64url').toString();
 assert.equal(payload.includes(credentials.linkToken),false);assert.equal(payload.includes(credentials.code),false);
 for(const token of[issued.grant+'.extra',issued.grant.slice(0,-1)+'!',createSessionToken(actor),'x'.repeat(2049),'malformed'])assert.equal(parseTrackingLinkGrant(token,now),null);
 assert.throws(()=>issueTrackingLinkGrant(id,credentials,new Date(now-1).toISOString(),now),/TRACKING_ACCESS_DENIED/);
 const future=issueTrackingLinkGrant(id,credentials,expires,now+60000);assert.equal(parseTrackingLinkGrant(future.grant,now),null);
});

test('Tracking creation/connect commands reject caller-selected authority and malformed credential/route inputs',()=>{
 const create={workspaceId:workspace,route:route.map(({placeRef})=>({placeRef})),cargoDescription:'Synthetic cargo',pickupDate:'',deliveryDate:'2026-11-19'};
 assert.equal(contracts.trackingSessionCreate.safeParse(create).success,true);
 for(const patch of[{actorId:actor},{canApprove:true},{shipmentId:id},{route:[{placeRef:'one'},{placeRef:'one'},{placeRef:'two'}]}])assert.equal(contracts.trackingSessionCreate.safeParse({...create,...patch}).success,false);
 const connect={linkToken:credentials.linkToken,code:credentials.code,vehicleId:other,trackingMode:'STATUS_ONLY'};
 assert.equal(contracts.trackingSessionConnect.safeParse(connect).success,true);
 for(const patch of[{actorId:actor},{provider_location_consent:true},{latitude:9},{trackingMode:'UNRESTRICTED'}])assert.equal(contracts.trackingSessionConnect.safeParse({...connect,...patch}).success,false);
});

test('malformed cargo/date/issue/connect inputs fail as400-class input errors before any RPC',async()=>{
 let calls=0;const service=trackingSessionService({rpc:async()=>{calls++;throw Error('MUST_NOT_OPEN_RPC');}});
 const create={workspaceId:workspace,route:route.map(({placeRef})=>({placeRef})),cargoDescription:'Synthetic cargo',pickupDate:'2026-11-18',deliveryDate:'2026-11-19'};
 for(const patch of[{cargoDescription:'  '},{cargoDescription:'x'.repeat(501)},{deliveryDate:''},{deliveryDate:'2026-02-30'},
  {pickupDate:'2026-13-01'},{deliveryDate:'2026-11-17'},{route:[{placeRef:'one'},{placeRef:'one'},{placeRef:'two'}]}]){
  assert.throws(()=>service.create(actor,{...create,...patch}),error=>error.code==='INVALID_TRACKING_INPUT');
 }
 for(const input of[{expiresInDays:31,allowLocation:false},{expiresInDays:7,allowLocation:'true'}])await assert.rejects(service.issue(actor,id,credentials,input),error=>error.code==='INVALID_TRACKING_INPUT');
 assert.equal(requestSchemas.requestCommand.safeParse({action:'ACCEPT',sessionId:id,revision:1,trackingMode:'UNRESTRICTED'}).success,false);
 assert.equal(calls,0);
});

test('Tracking issue port sends only keyed digests, authenticated actor and bounded command',async()=>{
 const calls=[],service=trackingSessionService({rpc:async(name,args)=>{calls.push({name,args});return{data:{id:other,sessionId:id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),revokedAt:null,allowLocation:false},error:null};}});
 await service.issue(actor,id,credentials,{expiresInDays:7,allowLocation:false});
 assert.equal(calls[0].name,'issue_tracking_session_link');assert.equal(calls[0].args.actor_user_id,actor);assert.equal(calls[0].args.target_session_id,id);
 assert.equal(calls[0].args.link_digest,credentials.linkDigest);assert.equal(calls[0].args.code_digest,credentials.codeDigest);
 assert.deepEqual(calls[0].args.command,{expiresInDays:7,allowLocation:false});
 assert.equal(JSON.stringify(calls).includes(credentials.linkToken),false);assert.equal(JSON.stringify(calls).includes(credentials.code),false);
});

test('guest port strips manager/proof capability fields and revalidates exact session, expiry and location authority',async()=>{
 let raw={...rawGuest(),state:'CONNECTED',shipmentId:other,shipment:shipment()},calls=0;
 const service=trackingSessionService({rpc:async()=>{calls++;return{data:raw,error:null};}});
 const shared=await service.guest(credentials,id);
 assert.equal(shared.session.workspaceId,null);assert.deepEqual(shared.session.links,[]);assert.equal(Object.values(shared.session.capabilities).some(Boolean),false);
 assert.equal(Object.hasOwn(shared.session.tracking.events[0],'hasProof'),false);assert.equal(shared.session.tracking.location.source,'MOBILE');assert.equal(shared.session.tracking.location.radiusKm,20);
 raw={...raw,shipment:{...shipment(),can_view_location:false}};assert.equal((await service.guest(credentials,id)).session.tracking.location,null);
 raw={...raw,id:actor};await assert.rejects(service.guest(credentials,id),/TRACKING_ACCESS_DENIED/);raw={...raw,id};
 await assert.rejects(service.guest(credentials,other),/TRACKING_ACCESS_DENIED/);
 raw={...raw,expiresAt:new Date(Date.now()-1).toISOString()};await assert.rejects(service.guest(credentials,id),/TRACKING_ACCESS_DENIED/);assert.equal(calls,5);
});

test('manager ports reject changed session/workspace identity in the RPC response',async()=>{
 const service=trackingSessionService({rpc:async()=>({data:{...rawManager(),id:other},error:null})});
 await assert.rejects(service.detail(actor,id),/TRACKING_UNAVAILABLE/);
 const wrongList=trackingSessionService({rpc:async()=>({data:{workspaceId:other,total:1,page:1,pageCount:1,sessions:[rawManager()]},error:null})});
 await assert.rejects(wrongList.list(actor,workspace),/TRACKING_UNAVAILABLE/);
});

test('the captured owner can list a connected personal shipment also shared with a workspace',async()=>{
 const owned={...rawManager(),state:'CONNECTED',shipmentId:other,shipment:shipment()};
 let rows=[owned];
 const service=trackingSessionService({rpc:async(name,args)=>{
  assert.equal(name,'tracking_session_workspace');
  assert.equal(args.actor_user_id,actor);
  return {data:{workspaceId:args.target_workspace_id,total:1,page:1,pageCount:1,sessions:rows},error:null};
 }});
 assert.equal((await service.list(actor,null)).sessions[0].shipmentId,other);
 await assert.rejects(service.list(actor,other),/TRACKING_UNAVAILABLE/);
 rows=[rawManager()];
 await assert.rejects(service.list(actor,null),/TRACKING_UNAVAILABLE/);
});

test('connected reads retain the saved update time and reject an incomplete shipment wire projection',async()=>{
 let raw={...rawManager(),state:'CONNECTED',shipmentId:other,shipment:shipment()};
 const service=trackingSessionService({rpc:async()=>({data:raw,error:null})});
 const connected=await service.detail(actor,id);
 assert.equal(connected.tracking.updatedAt,raw.shipment.updated_at);
 delete raw.shipment.updated_at;
 await assert.rejects(service.detail(actor,id),/TRACKING_UNAVAILABLE/);
 raw={...rawGuest(),state:'CONNECTED',shipmentId:other,shipment:raw.shipment};
 await assert.rejects(service.guest(credentials,id),/TRACKING_UNAVAILABLE/);
});

function accountSharingRoutes(){
 const calls=[],state={canManageTeam:false,recipientRole:'OWNER'},email='registered-owner@example.test';
 const domain=compile('src/lib/tracking-sharing/domain.ts',{z});
 const {accountOwnerVerification}=compile('src/lib/tracking-sharing/account-owner.ts',{providerTrackingRecipientDigest,TrackingSharingError:domain.TrackingSharingError});
 const ports={
  businessActorIdentity:async()=>{calls.push(['actor']);return{id:actor,email};},businessBody:body.businessBody,BusinessHttpError:body.BusinessHttpError,
  businessJson:body.businessJson,businessFailure:error=>Response.json({error:{code:error.code||'UNCLASSIFIED'}},{status:error.status||503}),businessLimit:async(...args)=>calls.push(['limit',...args]),
  trackingSessionId:contracts.trackingSessionId,trackingSharingId:value=>contracts.trackingSessionId.parse(value),attachTrackingBusiness:domain.attachTrackingBusiness,
  trackingSessionService:()=>({detail:async(...args)=>{calls.push(['detail',...args]);return{...rawManager(),shipmentId:other,capabilities:{canManageTeam:state.canManageTeam}};},fromShipment:async(...args)=>{calls.push(['fromShipment',...args]);return{...rawManager(),shipmentId:other,capabilities:{canManageTeam:state.canManageTeam}};}}),
  getProviderGuestTracking:async(...args)=>{calls.push(['legacyOwner',...args]);return{recipient_role:state.recipientRole};},providerTrackingRecipientDigest,accountOwnerVerification,
  trackingSharingService:()=>({owner:async(...args)=>{calls.push(['owner',...args]);return{shipmentId:other};},command:async(...args)=>{calls.push(['command',...args]);return{shipmentId:other};},attach:async(...args)=>{calls.push(['attach',...args]);return{shipmentId:other};}}),
  trackingSharingFailure:()=>null
 };
 const session=compile('src/app/api/tracking/sessions/[sessionId]/sharing/route.ts',ports);
 const attach=compile('src/app/api/business-workspaces/[workspaceId]/tracking/[shipmentId]/attach/route.ts',ports);
 const request=(input={expectedRevision:0})=>new Request('https://loadgistic.example/api/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
 return {calls,state,email,session,attach,request,sessionContext:{params:Promise.resolve({sessionId:id})},attachContext:{params:Promise.resolve({workspaceId:workspace,shipmentId:other})}};
}

test('NR87 readable teammates with a recycled owner email cannot reach owner verification or Team attachment',async()=>{
 const h=accountSharingRoutes();
 for(const response of[
  await h.session.GET(new Request('https://loadgistic.example/api/test'),h.sessionContext),
  await h.session.POST(h.request({action:'DETACH_BUSINESS',expectedRevision:0}),h.sessionContext),
  await h.attach.POST(h.request(),h.attachContext)
 ]){assert.equal(response.status,403);assert.equal((await response.json()).error.code,'BUSINESS_FORBIDDEN');}
 assert.equal(h.calls.filter(call=>call[0]==='detail').length,2);assert.equal(h.calls.filter(call=>call[0]==='fromShipment').length,1);
 assert.equal(h.calls.some(call=>['legacyOwner','owner','command','attach'].includes(call[0])),false,'captured account capability must deny before legacy email matching or normal owner commands');
});

test('NR87 captured owner capability still requires the verified account OWNER match before normal Team attachment',async()=>{
 const h=accountSharingRoutes();h.state.canManageTeam=true;h.state.recipientRole='VIEWER';
 assert.equal((await h.session.POST(h.request({action:'DETACH_BUSINESS',expectedRevision:0}),h.sessionContext)).status,403);
 assert.equal((await h.attach.POST(h.request(),h.attachContext)).status,403);
 assert.equal(h.calls.some(call=>['command','attach'].includes(call[0])),false);
 h.calls.length=0;h.state.recipientRole='OWNER';
 assert.equal((await h.session.GET(new Request('https://loadgistic.example/api/test'),h.sessionContext)).status,200);
 assert.equal((await h.session.POST(h.request({action:'DETACH_BUSINESS',expectedRevision:0}),h.sessionContext)).status,200);
 assert.equal((await h.attach.POST(h.request(),h.attachContext)).status,200);
 for(const call of h.calls.filter(call=>call[0]==='legacyOwner'))assert.deepEqual(call.slice(1),[other,providerTrackingRecipientDigest(h.email)]);
 const attached=h.calls.find(call=>call[0]==='attach');
 assert.deepEqual(attached.slice(1,4),[actor,workspace,other]);assert.equal(attached[4].digest,providerTrackingRecipientDigest(h.email));assert.equal(attached[5],0);
 h.calls.length=0;
 assert.equal((await h.attach.POST(h.request({expectedRevision:0,ownerVerification:'caller-supplied-proof'}),h.attachContext)).status,400);
 assert.equal(h.calls.some(call=>['fromShipment','legacyOwner','owner','command','attach'].includes(call[0])),false);
});

test('new SQL sessions begin at revision0 and remain readable after their first committed create',async()=>{
 const service=trackingSessionService({rpc:async()=>({data:{...rawManager(),revision:0},error:null})});
 const created=await service.create(actor,{workspaceId:workspace,route:route.map(({placeRef})=>({placeRef})),cargoDescription:'Synthetic new session',pickupDate:'',deliveryDate:'2026-11-19'});
 assert.equal(created.revision,0);assert.equal((await service.detail(actor,id)).revision,0);
});

function httpRuntime(){
 const calls=[],state={actor:null,originAllowed:true,scopeAllowed:true,revoked:false,proofAllowed:true};
 const consume=async(key,limit,windowMs)=>{calls.push(['limit',key,limit,windowMs]);return{allowed:key==='origin'?state.originAllowed:state.scopeAllowed,retryAfterSeconds:60};};
 const {checkOriginBeforeScopedLimit}=compile('src/lib/guest-rate-limit.js',{checkRateLimit:consume});
 const service={guest:async(...args)=>{calls.push(['guest',...args]);if(state.revoked)throw new TrackingSessionError('TRACKING_ACCESS_DENIED');return{session:{...rawManager(),workspaceId:null,capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false},links:[],tracking:null},expiresAt:new Date(Date.now()+600000).toISOString()};},detail:async(...args)=>{calls.push(['detail',...args]);return rawManager();},approve:async(...args)=>{calls.push(['approve',...args]);return rawManager();}};
 const proofBytes=Buffer.from('Synthetic proof transport bytes');
 service.proof=async(...args)=>{calls.push(['proof',...args]);if(!state.proofAllowed)throw new TrackingSessionError('FORBIDDEN');return{storage_path:'supabase://shipment-proof/synthetic-proof.png',mime_type:'image/png',original_name:'synthetic-proof.png'};};
 const {trackingSessionHttp}=compile('src/lib/tracking-sessions/http.ts',{
  z,...contracts,TrackingSessionError,mutationOriginAllowed,checkOriginBeforeScopedLimit,requestKey:()=> 'origin',
  businessBody:body.businessBody,BusinessHttpError:body.BusinessHttpError,businessActorIdentity:async()=>{calls.push(['actor']);if(!state.actor)throw new body.BusinessHttpError(401,'SIGN_IN_REQUIRED');return{id:state.actor};},businessLimit:async(...args)=>calls.push(['actorLimit',...args]),
  createTrackingSessionCredentials:()=>createTrackingSessionCredentials(environment),trackingSessionCredentialDigests:digest,
  ...requestSchemas,issueTrackingLinkGrant,parseTrackingLinkGrant,TRACKING_LINK_GRANT_COOKIE,trackingSessionService:()=>service,
  privateFilePayload,privateDocumentHeaders,readPrivateUpload:async reference=>{calls.push(['privateFile',reference]);return proofBytes;},
  process:{env:{NODE_ENV:'production',APP_URL:'https://loadgistic.example'}}
 });
 const access=(value={linkToken:credentials.linkToken,code:credentials.code},headers={})=>new Request('https://loadgistic.example/api/tracking-sessions/access',{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof value==='string'?value:JSON.stringify(value)});
 return{calls,state,service,proofBytes,run:trackingSessionHttp,access};
}

test('account proof binary and native base64 use the same exact-session authorization and private file port',async()=>{
 const h=httpRuntime();h.state.actor=actor;
 for(const format of['','?format=base64']){
  const response=await h.run(new Request('https://loadgistic.example/api/tracking/sessions/'+id+'/proof/'+other+format),'PROOF',{sessionId:id,eventId:other});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  if(format){assert.deepEqual(await response.json(),{ok:true,data:{mimeType:'image/png',base64:h.proofBytes.toString('base64')}});}
  else{assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),h.proofBytes);}
 }
 assert.deepEqual(h.calls.filter(call=>call[0]==='proof'),[['proof',actor,id,other],['proof',actor,id,other]]);
 assert.equal(h.calls.filter(call=>call[0]==='privateFile').length,2);
});

test('guest grants, denied accounts and malformed proof formats cannot reach private file bytes',async()=>{
 const grant=issueTrackingLinkGrant(id,credentials,new Date(Date.now()+600000).toISOString()).grant;
 for(const format of['','?format=base64']){
  const h=httpRuntime(),response=await h.run(new Request('https://loadgistic.example/api/tracking/sessions/'+id+'/proof/'+other+format,{headers:{'x-loadgistic-tracking-grant':grant}}),'PROOF',{sessionId:id,eventId:other});
  assert.equal(response.status,401);assert.deepEqual(h.calls,[['actor']]);
 }
 const denied=httpRuntime();denied.state.actor=actor;denied.state.proofAllowed=false;
 assert.equal((await denied.run(new Request('https://loadgistic.example/api/test?format=base64'),'PROOF',{sessionId:id,eventId:other})).status,403);
 assert.equal(denied.calls.some(call=>call[0]==='privateFile'),false);
 for(const params of[{sessionId:id,eventId:other,query:'?format=raw'},{sessionId:id,eventId:'invalid',query:'?format=base64'}]){
  const h=httpRuntime();h.state.actor=actor;
  assert.equal((await h.run(new Request('https://loadgistic.example/api/test'+params.query),'PROOF',params)).status,400);
  assert.equal(h.calls.some(call=>['proof','privateFile'].includes(call[0])),false);
 }
});

test('guest access origin and IP budget precede body parsing, scoped budget and credential lookup',async()=>{
 const h=httpRuntime();
 assert.equal((await h.run(h.access(undefined,{origin:'https://other.invalid'}),'ACCESS')).status,403);assert.deepEqual(h.calls,[]);
 h.state.originAllowed=false;
 assert.equal((await h.run(h.access('not-json'),'ACCESS')).status,429);assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'origin');
 h.calls.length=0;h.state.originAllowed=true;h.state.scopeAllowed=false;
 assert.equal((await h.run(h.access(),'ACCESS')).status,429);
 assert.deepEqual(h.calls.map(call=>call[0]),['limit','limit']);assert.equal(h.calls[0][2],12);assert.equal(h.calls[1][2],5);
 assert.equal(h.calls[1][1],'tracking-unlock-link:'+credentials.linkDigest);assert.equal(h.calls[0][3],600000);
});

test('malformed credentials/body never reach saved-link lookup and unavailable services retain a generic503',async()=>{
 for(const input of['not-json',{linkToken:'short',code:credentials.code},{linkToken:credentials.linkToken,code:credentials.code,canApprove:true}]){
  const h=httpRuntime(),response=await h.run(h.access(input),'ACCESS');assert.equal(response.status>=400,true);assert.equal(h.calls.some(call=>call[0]==='guest'),false);
 }
 const h=httpRuntime();h.service.guest=async()=>{throw Error('private contact and database detail');};
 const response=await h.run(h.access(),'ACCESS');assert.equal(response.status,503);assert.equal((await response.text()).includes('private contact'),false);
});

test('missing or expired saved links deny401 while RPC/projection outages stay503 without clearing a valid grant',async()=>{
 const port=async value=>({rpc:async()=>value}),cases=[
  [{data:null,error:null},401],
  [{data:rawGuest(),error:{message:'Synthetic transport outage private detail'}},503],
  [{data:{malformed:true},error:null},503]
 ];
 for(const [result,status]of cases){
  const h=httpRuntime(),service=trackingSessionService(await port(result));
  const initial=await h.run(h.access(),'ACCESS');assert.equal(initial.status,200);const grant=(await initial.json()).data.grant;
  h.service.guest=service.guest;
  const access=await h.run(h.access(),'ACCESS');assert.equal(access.status,status);assert.equal(access.headers.get('set-cookie'),null);
  const read=await h.run(new Request('https://loadgistic.example/api/test',{headers:{'x-loadgistic-tracking-grant':grant}}),'DETAIL',{sessionId:id});
  assert.equal(read.status,status);assert.equal(read.headers.get('set-cookie'),null);assert.ok(parseTrackingLinkGrant(grant));
  assert.equal((await read.text()).includes('private detail'),false);
 }
 const expired=httpRuntime();expired.service.guest=trackingSessionService(await port({data:{...rawGuest(),expiresAt:new Date(Date.now()-1).toISOString()},error:null})).guest;
 assert.equal((await expired.run(expired.access(),'ACCESS')).status,401);
});

test('every grant read revalidates revocation and cannot switch to another session',async()=>{
 const h=httpRuntime(),access=await h.run(h.access(),'ACCESS');assert.equal(access.status,200);
 const data=await access.json(),grant=data.data.grant;
 assert.match(access.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=\d+; Secure/);
 assert.match(access.headers.get('cache-control'),/no-store/);assert.equal(access.headers.get('referrer-policy'),'no-referrer');
 const read=sessionId=>h.run(new Request('https://loadgistic.example/api/tracking-sessions/'+sessionId,{headers:{'x-loadgistic-tracking-grant':grant}}),'DETAIL',{sessionId});
 assert.equal((await read(id)).status,200);const before=h.calls.filter(call=>call[0]==='guest').length;
 assert.equal((await read(other)).status,401);assert.equal(h.calls.filter(call=>call[0]==='guest').length,before);
 h.state.revoked=true;assert.equal((await read(id)).status,401);assert.equal(h.calls.filter(call=>call[0]==='guest').length,before+1);
});

test('guest grants never authorize manager commands or turn into an owner session',async()=>{
 const h=httpRuntime(),grant=issueTrackingLinkGrant(id,credentials,new Date(Date.now()+600000).toISOString()).grant;
 for(const operation of['APPROVE','ISSUE','CONNECT','REVOKE','CREATE']){
  const response=await h.run(new Request('https://loadgistic.example/api/tracking-sessions/'+id,{method:'POST',headers:{'x-loadgistic-tracking-grant':grant,'content-type':'application/json'},body:'{}'}),operation,{sessionId:id});
  assert.equal(response.status,401);
 }
 assert.equal(h.calls.some(call=>['approve','actorLimit','detail'].includes(call[0])),false);
});

test('declared Tracking RPC denial/conflict/input codes retain safe HTTP404/409/400 semantics',async()=>{
 for(const [message,operation,method,status]of[
  ['NOT_FOUND','DETAIL','GET',404],['TRACKING_SESSION_NOT_FOUND','DETAIL','GET',404],
  ['TRACKING_SESSION_ALREADY_CONNECTED','REQUEST','POST',409],['INVALID_TRACKING_INPUT','REQUEST','POST',400],
  ['INVALID_TRACKING_MODE','REQUEST','POST',400]
 ]){
  const h=httpRuntime(),service=trackingSessionService({rpc:async()=>({data:null,error:{message}})});h.state.actor=actor;
  h.service.detail=service.detail;h.service.request=service.request;
  const request=new Request('https://loadgistic.example/api/tracking-sessions/'+id,{method,
   ...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify({action:'ACCEPT',sessionId:id,revision:1,trackingMode:'STATUS_ONLY'})}:{})});
  const response=await h.run(request,operation,{sessionId:id});
  assert.equal(response.status,status,message+' must not be presented as a transient503');
 }
});

test('signed-in providers cannot claim a load with a guest link and code',async()=>{
 const h=httpRuntime();h.state.actor=actor;
 const response=await h.run(h.access(),'CONNECT',{sessionId:id});
 assert.equal(response.status,410);
 assert.equal((await response.json()).error.code,'TRACKING_REQUEST_REQUIRED');
});
