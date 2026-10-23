import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {dateOnly} from '../src/lib/date-calendar.js';
import {trackingRoute,trackingMapLocation,trackingPublicTruck} from '../src/lib/tracking-map.js';
import {phoneInstallationProof} from '../src/lib/phone-location-contract.js';
import {providerTrackingRecipientDigest} from '../src/lib/security.js';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',staff='00000000-0000-4000-8000-000000000003';
function compile(path,ports){const file=readFileSync(path,'utf8'),parsed=ts.createSourceFile(path,file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,exports={};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);return exports;}
const tracking=compile('src/lib/mobile/tracking-contract.ts',{z,dateOnly,trackingRoute,trackingMapLocation,trackingPublicTruck,phoneInstallationProof});
const domain=compile('src/lib/tracking-sharing/domain.ts',{z,guestTrackingDetail:tracking.guestTrackingDetail,trackingSummary:tracking.trackingSummary});
const {trackingSharingService}=compile('src/lib/tracking-sharing/server.ts',{...domain,providerTrackingRecipientDigest,createSupabaseAdminClient(){throw Error('Tests must inject the bounded RPC port');}});
const sharing={shipmentId:id,revision:1,canInvite:true,viewers:[],business:null,staff:[]};
const raw=()=>({workspaceId:other,isOwner:false,shipment:{id,code:'LGX-SYNTHETIC',origin:'Origin',destination:'Destination',cargo_summary:'Cargo',
 operational_status:'LOADING',tracking_mode:'LOCATION_AND_STATUS',provider_name:'Synthetic provider',recipient_role:'BUSINESS_STAFF',
 can_view_location:false,can_approve:false,can_review:false,can_share:false,current_location:null,
 route:[{placeRef:'one',label:'Origin',coordinate:[38,9]},{placeRef:'two',label:'Destination',coordinate:[39,10]}],
 events:[{id:staff,status:'LOADING',has_proof:false,note:'Loading saved',created_at:'2026-10-18T12:00:00Z'}]}});
test('only named status viewers and explicit revocable staff grants are accepted as owner commands',()=>{
 const command={action:'ADD_VIEWER',expectedRevision:0,name:'Dispatch desk',email:'desk@example.test'};
 assert.equal(domain.ownerSharingCommand.safeParse(command).success,true);
 for(const extra of [{actorId:id},{digest:'f'.repeat(64)},{verifiedAt:Date.now()},{owner:true},{canViewLocation:true},{name:'\n'},{expectedRevision:-1}])assert.equal(domain.ownerSharingCommand.safeParse({...command,...extra}).success,false);
 assert.equal(domain.ownerSharingCommand.safeParse({action:'ALLOW_LOCATION',expectedRevision:1,userId:staff}).success,true);
 assert.equal(domain.ownerSharingCommand.safeParse({action:'ATTACH_BUSINESS',expectedRevision:1,workspaceId:other}).success,false,'attachment requires a separate authenticated member operation');
 assert.equal(domain.attachTrackingBusiness.safeParse({expectedRevision:1,ownerVerification:'signed-visitor-token',actorId:id}).success,false);
});
test('sharing adapter derives digests and receives freshness only from the inbound verification port',async()=>{
 const calls=[],service=trackingSharingService({rpc:async(name,args)=>{calls.push({name,args});return{data:sharing,error:null};}}),proof={digest:'a'.repeat(64),startedAt:Date.parse('2026-10-18T12:00:00Z')};
 await service.command(id,proof,{action:'ADD_VIEWER',expectedRevision:0,name:'Receiver',email:'Person@Example.test'});
 const value=calls[0];assert.equal(value.name,'tracking_owner_sharing_command');assert.equal(value.args.recipient_digest,proof.digest);assert.equal(value.args.verified_at,'2026-10-18T12:00:00.000Z');
 assert.equal(value.args.command.email,'person@example.test');assert.equal(value.args.command.digest,providerTrackingRecipientDigest('person@example.test'));assert.equal('actor_user_id'in value.args,false);
 await assert.rejects(service.command(id,proof,{action:'ADD_VIEWER',expectedRevision:1,name:'Receiver',email:'person@example.test',digest:'forged'}),/INVALID_TRACKING_RECIPIENTS/);assert.equal(calls.length,1);
 await service.attach(staff,other,id,proof,1);assert.equal(calls[1].args.actor_user_id,staff);assert.deepEqual(calls[1].args.command,{action:'ATTACH_BUSINESS',workspaceId:other,expectedRevision:1});
});
test('business detail minimizes private data and rejects a hidden position or delegated approval',()=>{
 const input=raw();input.shipment.privateToken='PRIVATE';input.shipment.latest_location={location_lat:1,location_lng:2};input.shipment.events[0].proof_url='PRIVATE';input.shipment.events[0].location_lat=1;
 const result=domain.businessTrackingProjection(input,other,id),serialized=JSON.stringify(result);
 assert.equal(result.shipment.current_location,null);assert.equal(result.shipment.can_view_location,false);assert.equal(serialized.includes('PRIVATE'),false);assert.equal(serialized.includes('latest_location'),false);assert.equal(serialized.includes('proof_url'),false);assert.equal(serialized.includes('location_lat'),false);
 for(const patch of [{current_location:{location_lat:1,location_lng:2}},{can_approve:true},{can_share:true},{recipient_role:'OWNER'}])assert.throws(()=>domain.businessTrackingProjection({...raw(),shipment:{...raw().shipment,...patch}},other,id),/TRACKING_UNAVAILABLE/);
 assert.throws(()=>domain.businessTrackingProjection(raw(),id,id),/TRACKING_UNAVAILABLE/);
});
test('explicit position keeps the actual source, radius and time without granting proof or approval',()=>{
 const value=raw();value.shipment.can_view_location=true;value.shipment.current_location={location_lat:9.1,location_lng:38.1,location_area:'Approximate location',location_precision_km:10,location_source:'MANUAL_ADMIN',updated_at:'2026-10-18T12:00:00Z',installationId:'PRIVATE'};
 const result=domain.businessTrackingProjection(value,other,id);
 assert.equal(result.shipment.current_location.location_source,'MANUAL');assert.equal(result.shipment.current_location.location_precision_km,10);assert.equal(result.shipment.current_location.updated_at,'2026-10-18T12:00:00Z');
 assert.equal(result.shipment.can_approve,false);assert.equal(result.shipment.can_share,false);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
test('provider creation and recipient commands cannot expand the one-owner audience',()=>{
 const input={vehicleId:id,originPlaceRef:'one',passingPlaceRef:'two',destinationPlaceRef:'three',cargoSummary:'Cargo',customerEmail:'owner@example.test',trackingMode:'STATUS_ONLY',expectedDeliveryDate:'2026-10-20'};
 assert.equal(tracking.createTracking.safeParse(input).success,true);assert.equal(tracking.createTracking.safeParse({...input,additionalRecipientEmails:[]}).success,true);
 assert.equal(tracking.createTracking.safeParse({...input,additionalRecipientEmails:['viewer@example.test']}).success,false);
 for(const command of [{action:'ADD_RECIPIENT',email:'viewer@example.test'},{action:'REVOKE_RECIPIENT',recipientId:other}])assert.equal(tracking.trackingCommand.safeParse(command).success,false);
 assert.equal(tracking.trackingDetail({guest_access_active:true,operational_status:'CREATED'},{id,role:'DRIVER'},[]).canManageRecipients,false);
});

test('sharing failures have both supported translations, including stale permissions and revocation',async()=>{
 const {trackingSharingMessages}=compile('src/lib/i18n/tracking-sharing-messages.ts',{});
 const {trackingSharingFailure}=compile('src/lib/tracking-sharing/http.ts',{z,TrackingSharingError:domain.TrackingSharingError,MobileError:class extends Error{},businessJson:(body,status)=>Response.json(body,{status})});
 for(const code of ['TRACKING_SESSION_EXPIRED','TRACKING_APPROVAL_FORBIDDEN','TRACKING_SHARING_CHANGED','TRACKING_RECIPIENT_EXISTS','TRACKING_RECIPIENT_LIMIT','TRACKING_RECIPIENTS_CLOSED','INVALID_TRACKING_RECIPIENTS','BUSINESS_FORBIDDEN','NOT_FOUND']){const response=trackingSharingFailure(new domain.TrackingSharingError(code)),message=(await response.json()).error.message;for(const locale of ['am','om'])assert.ok(trackingSharingMessages[locale][message]&&trackingSharingMessages[locale][message]!==message,`${locale}: ${code}`);}
});
