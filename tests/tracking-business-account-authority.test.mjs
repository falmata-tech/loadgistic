import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {providerTrackingRecipientDigest} from '../src/lib/security.js';

const actor='00000000-0000-4000-8000-000000000001',workspace='00000000-0000-4000-8000-000000000002';
const shipment='00000000-0000-4000-8000-000000000003',event='00000000-0000-4000-8000-000000000004';
function compile(path,ports={}){
 const parsed=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,exports={};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);return exports;
}
const domain=compile('src/lib/tracking-sharing/domain.ts',{z});
const body=compile('src/lib/business-workspaces/http.ts');
const {accountOwnerVerification}=compile('src/lib/tracking-sharing/account-owner.ts',{providerTrackingRecipientDigest,TrackingSharingError:domain.TrackingSharingError});

function harness(){
 const calls=[],state={capturedOwner:false,legacyEmailMatches:true,canApprove:true,canReview:true};
 const ports={
  z,after:()=>{},NextResponse:Response,businessActorIdentity:async()=>({id:actor,email:'reassigned-owner@example.test'}),
  businessBody:async request=>request.json(),businessJson:body.businessJson,BusinessHttpError:body.BusinessHttpError,
  businessFailure:error=>Response.json({error:{code:error.code||'UNAVAILABLE'}},{status:error.status||503}),businessLimit:async()=>{},
  trackingSharingId:value=>z.string().uuid().parse(value),TrackingSharingError:domain.TrackingSharingError,accountOwnerVerification,
  trackingSharingFailure:error=>error instanceof domain.TrackingSharingError?Response.json({error:{code:error.code}},{status:403}):null,
  // This is the authoritative business_tracking_detail envelope, not the
  // legacy email-only predicate. SQL tests qualify the actual captured-UID
  // branch, including legacyEmailMatches=true with isOwner=false.
  getBusinessTrackingDetail:async(...args)=>{calls.push(['businessDetail',...args]);return{workspaceId:workspace,isOwner:state.capturedOwner,
   shipment:{id:shipment,projection:'WORKSPACE_SAFE',can_view_location:false,current_location:null,events:[]}};},
  getProviderGuestTracking:async(...args)=>{calls.push(['legacyOwner',...args]);return{recipient_role:state.legacyEmailMatches?'OWNER':'VIEWER',projection:'OWNER_PRIVATE',can_approve:state.canApprove,can_review:state.canReview};},
  guestTrackingDetail:value=>({id:shipment,projection:value.projection}),
  trackingSharingService:()=>({owner:async(...args)=>{calls.push(['teamRead',...args]);return{shipmentId:shipment};},command:async(...args)=>{calls.push(['teamWrite',...args]);return{shipmentId:shipment};}}),
  approveProviderHandover:async(...args)=>calls.push(['approve',...args]),submitTrackingEmailReview:async(...args)=>calls.push(['review',...args]),deliverPendingShipmentEmails:async()=>{},
  readProviderTrackingProof:async(...args)=>{calls.push(['proof',...args]);return{bytes:Buffer.from('synthetic-proof'),mimeType:'image/png',originalName:'synthetic.png'};},
  privateDocumentHeaders:()=>({'Content-Type':'image/png','Cache-Control':'private, no-store'})
 };
 const base='src/app/api/business-workspaces/[workspaceId]/tracking/[shipmentId]/';
 const routes=Object.fromEntries([['detail','route.ts'],['actions','actions/route.ts'],['sharing','sharing/route.ts'],['proof','proof/[eventId]/route.ts']].map(([name,file])=>[name,compile(base+file,ports)]));
 const context={params:Promise.resolve({workspaceId:workspace,shipmentId:shipment,eventId:event})};
 const get=()=>new Request('https://loadgistic.test/api/business-workspaces/'+workspace+'/tracking/'+shipment);
 const post=value=>new Request(get().url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
 return{calls,state,routes,context,get,post};
}
const elevated=new Set(['legacyOwner','teamRead','teamWrite','approve','review','proof']);

test('NR87 retained business detail preserves safe reader access despite a matching recycled owner email',async()=>{
 const h=harness(),response=await h.routes.detail.GET(h.get(),h.context),value=await response.json();
 assert.equal(response.status,200);assert.equal(value.isOwner,false);assert.equal(value.projection,'WORKSPACE_SAFE');assert.equal(value.canViewLocation,false);
 assert.equal(h.calls.some(call=>elevated.has(call[0])),false);
 assert.deepEqual(h.calls[0],['businessDetail',actor,workspace,shipment]);
});

test('NR87 false captured-owner envelope denies retained proof, approval, review and Team ports before access',async()=>{
 const h=harness();
 const responses=[await h.routes.proof.GET(h.get(),h.context),await h.routes.actions.POST(h.post({action:'APPROVE'}),h.context),
  await h.routes.actions.POST(h.post({action:'REVIEW',rating:5,note:'Synthetic review',termsAccepted:true}),h.context),
  await h.routes.sharing.GET(h.get(),h.context),await h.routes.sharing.POST(h.post({action:'DETACH_BUSINESS',expectedRevision:0}),h.context)];
 for(const response of responses)assert.equal(response.status,403);
 assert.equal(h.calls.some(call=>elevated.has(call[0])),false,'safe read permission and matching email must not reach an OWNER/private-file command');
});

test('NR87 ordinary reader with no owner email keeps route/status access and no owner ports',async()=>{
 const h=harness();h.state.legacyEmailMatches=false;
 const response=await h.routes.detail.GET(h.get(),h.context);assert.equal(response.status,200);assert.equal((await response.json()).projection,'WORKSPACE_SAFE');
 assert.equal(h.calls.some(call=>elevated.has(call[0])),false);
});

test('captured actual business owner retains normal detail, proof, approval, review and Team operations',async()=>{
 const h=harness();h.state.capturedOwner=true;
 const detail=await h.routes.detail.GET(h.get(),h.context);assert.equal(detail.status,200);assert.equal((await detail.json()).projection,'OWNER_PRIVATE');
 const proof=await h.routes.proof.GET(h.get(),h.context);assert.equal(proof.status,200);assert.equal(await proof.text(),'synthetic-proof');
 assert.equal((await h.routes.actions.POST(h.post({action:'APPROVE'}),h.context)).status,200);
 assert.equal((await h.routes.actions.POST(h.post({action:'REVIEW',rating:4,note:'Synthetic review',termsAccepted:true}),h.context)).status,200);
 assert.equal((await h.routes.sharing.GET(h.get(),h.context)).status,200);
 assert.equal((await h.routes.sharing.POST(h.post({action:'REVOKE_VIEWER',recipientId:event,expectedRevision:0}),h.context)).status,200);
 for(const name of ['legacyOwner','proof','approve','review','teamRead','teamWrite'])assert.ok(h.calls.some(call=>call[0]===name),name);
 for(const call of h.calls.filter(call=>call[0]==='legacyOwner'))assert.deepEqual(call.slice(1),[shipment,providerTrackingRecipientDigest('reassigned-owner@example.test')]);
});

test('captured owner still cannot bypass current action denial or restore retired email sharing',async()=>{
 const h=harness();h.state.capturedOwner=true;h.state.canApprove=false;h.state.canReview=false;
 assert.equal((await h.routes.actions.POST(h.post({action:'APPROVE'}),h.context)).status,403);
 assert.equal((await h.routes.actions.POST(h.post({action:'REVIEW',rating:5,note:'',termsAccepted:true}),h.context)).status,403);
 assert.equal((await h.routes.sharing.POST(h.post({action:'ADD_VIEWER',expectedRevision:0,email:'unrelated@example.test'}),h.context)).status,410);
 assert.equal(h.calls.some(call=>['approve','review','teamWrite'].includes(call[0])),false);
});

test('native historical-admission tests execute the exact one-time migration backfill body',()=>{
 const migration=readFileSync('supabase/migrations/229_tracking_session_links.sql','utf8');
 const native=readFileSync('tests/sql/tracking-session-links.sql','utf8');
 const marker=/\$historybackfill229\$([\s\S]*?)\$historybackfill229\$;/g;
 const actual=[...migration.matchAll(marker)],tested=[...native.matchAll(marker)];
 assert.equal(actual.length,1);assert.equal(tested.length,1);assert.equal(tested[0][1],actual[0][1]);
});

test('migration transaction installs lock and statement bounds before its first advisory lock',()=>{
 const source=readFileSync('supabase/migrations/229_tracking_session_links.sql','utf8');
 const transaction=source.slice(source.indexOf('begin;'));
 assert.ok(transaction.startsWith("begin;\nset local lock_timeout='5s';\nset local statement_timeout='30s';\nselect pg_advisory_xact_lock(8030229);"));
 assert.equal((source.match(/select pg_advisory_xact_lock\(8030229\);/g)||[]).length,1);
});
