import {z} from 'zod';
import {businessActorIdentity,businessBody,businessLimit,BusinessHttpError} from '../business-workspaces/http';
import {mutationOriginAllowed} from '../origin.js';
import {checkOriginBeforeScopedLimit} from '../guest-rate-limit.js';
import {requestKey} from '../rate-limit';
import {providerTrackingRecipientDigest,createTrackingSessionCredentials,trackingSessionCredentialDigests} from '../security.js';
import {issueTrackingLinkGrant,parseTrackingLinkGrant,TRACKING_LINK_GRANT_COOKIE} from './grant.js';
import {trackingSessionId,trackingLinkToken,trackingLinkCode,trackingSessionIssueInput,trackingSessionReferenceSearch} from './contracts';
import {trackingSessionService,TrackingSessionError} from './supabase';
import {readPrivateUpload,privateDocumentHeaders} from '../private-storage.js';
import {privateFilePayload} from '../mobile/file-contract.js';

import {requestCommand} from './requests';

type Operation='REQUEST'|'ACCESS'|'LOGOUT'|'LIST'|'REFERENCE_SEARCH'|'CREATE'|'DETAIL'|'ATTACH_PARTNER'|'FROM_SHIPMENT'|'ISSUE'|'REVOKE'|'CONNECT'|'APPROVE'|'REVIEW'|'PROOF';
type Params={sessionId?:string;eventId?:string};
export function trackingSessionJson(data:unknown,status=200):Response{
 return Response.json({ok:true,data},{status,headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store',Vary:'Cookie, Authorization, x-loadgistic-tracking-grant','X-Robots-Tag':'noindex, nofollow, nosnippet, noimageindex','Referrer-Policy':'no-referrer'}});
}
export function retiredTrackingAccess():Response{
 const response=trackingSessionJson(null,410);return failure(410,'TRACKING_LINK_REQUIRED','Open the shipment’s current tracking link and enter its code.',response.headers);
}
function failure(status:number,code:string,message:string,headers?:Headers):Response{
 const response=trackingSessionJson(null,status);
 if(headers)for(const [name,value]of headers)response.headers.set(name,value);
 return new Response(JSON.stringify({ok:false,error:{code,message}}),{status,headers:response.headers});
}
function cookie(request:Request){
 const supplied=request.headers.get('x-loadgistic-tracking-grant');if(supplied!==null)return supplied;
 const match=(request.headers.get('cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(TRACKING_LINK_GRANT_COOKIE+'='));
 return match?.slice(TRACKING_LINK_GRANT_COOKIE.length+1)??null;
}
function setCookie(response:Response,grant:string,maxAge:number){response.headers.append('Set-Cookie',`${TRACKING_LINK_GRANT_COOKIE}=${grant}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`);}
function input<T>(schema:z.ZodType<T>,value:unknown):T{const parsed=schema.safeParse(value);if(!parsed.success)throw new TrackingSessionError('INVALID_TRACKING_SESSION');return parsed.data;}
function applicationOrigin(){
 try{const url=new URL(process.env.APP_URL||'');if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw Error();return url.origin;}
 catch{throw new TrackingSessionError('TRACKING_UNAVAILABLE');}
}
/** Every guest read is exact-session scoped and revalidates the saved link. */
export async function trackingSessionHttp(request:Request,operation:Operation,params:Params={}){
 try{
  if(!['GET','HEAD'].includes(request.method)&&!mutationOriginAllowed(request.headers,request.url))throw new BusinessHttpError(403,'INVALID_ORIGIN');
  if(operation==='LOGOUT'){const response=trackingSessionJson({cleared:true});setCookie(response,'',0);return response;}
  const service=trackingSessionService();
  if(operation==='ACCESS'){
   const rate=await checkOriginBeforeScopedLimit({originKey:requestKey(request,'tracking-unlock'),originLimit:12,windowMs:10*60_000,scopedLimit:5,
    readScope:async()=>{
     const parsed=z.object({linkToken:trackingLinkToken,code:trackingLinkCode}).strict().safeParse(await businessBody(request));
     if(!parsed.success)throw new TrackingSessionError('TRACKING_ACCESS_DENIED');
     const digests=trackingSessionCredentialDigests(parsed.data.linkToken,parsed.data.code);
     return {key:'tracking-unlock-link:'+digests.linkDigest,value:digests};
    }});
   if(!rate.allowed||!rate.scope)return failure(429,'RATE_LIMITED','Please wait before trying again.');
   const shared=await service.guest(rate.scope);
   const granted=issueTrackingLinkGrant(shared.session.id,rate.scope,shared.expiresAt),response=trackingSessionJson({...granted,session:shared.session});
   setCookie(response,granted.grant,Math.max(1,Math.floor((Date.parse(granted.expiresAt)-Date.now())/1000)));return response;
  }
  const sessionId=params.sessionId?input(trackingSessionId,params.sessionId):null;
  const url=new URL(request.url),rawGrant=cookie(request);
  if(operation==='DETAIL'&&rawGrant&&url.searchParams.get('view')!=='manager'&&(request.headers.has('x-loadgistic-tracking-grant')||!request.headers.has('authorization'))){
   const grant=parseTrackingLinkGrant(rawGrant);
   if(!grant||grant.sessionId!==sessionId)throw new TrackingSessionError('TRACKING_ACCESS_DENIED');
   const shared=await service.guest(grant,sessionId!);
   return trackingSessionJson(shared.session);
  }
  const actor=await businessActorIdentity(request);
  if(operation==='PROOF'){
   if(url.searchParams.has('format')&&url.searchParams.get('format')!=='base64')throw new TrackingSessionError('INVALID_TRACKING_INPUT');
   const file=await service.proof(actor.id,sessionId!,input(trackingSessionId,params.eventId));
   if(!file)throw new TrackingSessionError('NOT_FOUND');
   const bytes=await readPrivateUpload(file.storage_path);if(!bytes)throw new TrackingSessionError('NOT_FOUND');
   if(url.searchParams.get('format')==='base64')return trackingSessionJson(privateFilePayload(bytes,file.mime_type));
   return new Response(bytes,{headers:{...privateDocumentHeaders(file.mime_type,file.original_name),'Referrer-Policy':'no-referrer'}});
  }
  if(operation==='LIST'){
   const workspace=url.searchParams.get('workspaceId'),page=url.searchParams.get('page')||'1';
   if(!/^[1-9]\d{0,3}$/.test(page))throw new TrackingSessionError('INVALID_TRACKING_SESSION');
   return trackingSessionJson(await service.list(actor.id,workspace===null?null:input(trackingSessionId,workspace),Number(page)));
  }
  if(operation==='DETAIL')return trackingSessionJson(await service.detail(actor.id,sessionId!));
  await businessLimit(actor.id,'tracking-session:'+operation,operation==='CONNECT'?5:20);
  if(operation==='REFERENCE_SEARCH'){
   const inputValue=input(trackingSessionReferenceSearch,await businessBody(request));
   return trackingSessionJson(await service.list(actor.id,inputValue.workspaceId,inputValue.page,inputValue.reference));
  }
  if(operation==='REQUEST')return trackingSessionJson(await service.request(actor.id,input(requestCommand,await businessBody(request))));
  if(operation==='CREATE')return trackingSessionJson(await service.create(actor.id,await businessBody(request)),201);
  if(operation==='ATTACH_PARTNER'){
   const body=input(z.object({shipmentId:trackingSessionId,email:z.string().trim().email().max(254)}).strict(),await businessBody(request));
   return trackingSessionJson(await service.attachPartner(actor.id,body.shipmentId,body.email,providerTrackingRecipientDigest(body.email)));
  }
  if(operation==='FROM_SHIPMENT'){
   const body=input(z.object({shipmentId:trackingSessionId,workspaceId:trackingSessionId.optional()}).strict(),await businessBody(request));
   return trackingSessionJson(await service.fromShipment(actor.id,body.shipmentId,body.workspaceId??null));
  }
  if(operation==='ISSUE'){
   const body=input(trackingSessionIssueInput,await businessBody(request)),origin=applicationOrigin(),credentials=createTrackingSessionCredentials();
   const link=await service.issue(actor.id,sessionId!,credentials,body);
   return trackingSessionJson({link:{id:link.id,url:origin+'/track/'+credentials.linkToken,code:credentials.code,expiresAt:link.expiresAt,allowLocation:link.allowLocation}},201);
  }
  if(operation==='REVOKE')return trackingSessionJson(await service.revoke(actor.id,sessionId!,input(trackingSessionId,url.searchParams.get('linkId'))));
  if(operation==='CONNECT')return failure(410,'TRACKING_REQUEST_REQUIRED','Open Tracking requests in your provider account.');
  if(operation==='APPROVE')return trackingSessionJson(await service.approve(actor.id,sessionId!));
  if(operation==='REVIEW')return trackingSessionJson(await service.review(actor.id,sessionId!,await businessBody(request)));
  throw new BusinessHttpError(404,'NOT_FOUND');
 }catch(error){
  if(error instanceof BusinessHttpError)return failure(error.status,error.code,error.status===401?'Sign in to continue.':error.status===429?'Please wait before trying again.':'This action is not available for this account.');
  if(error instanceof TrackingSessionError){
   if(error.code==='TRACKING_ACCESS_DENIED')return failure(401,error.code,'That tracking link and code are unavailable or expired.');
   if(['FORBIDDEN','BUSINESS_FORBIDDEN','TRACKING_SESSION_FORBIDDEN','TRACKING_APPROVAL_FORBIDDEN','INVALID_VEHICLE','REVIEW_WORKSPACE_ONLY','REVIEW_NOT_ALLOWED','SUBSCRIPTION_ACCESS_REQUIRED','POLICY_REQUIRED'].includes(error.code))return failure(403,'TRACKING_SESSION_FORBIDDEN','This action is not available for this account and shipment.');
   if(error.code==='TRACKING_REGISTERED_OWNER_REQUIRED')return failure(400,error.code,'Choose an existing shipper or broker account as the shipment owner.');
   if(error.code.startsWith('INVALID_')||['LOCALITY_REQUIRED','ROUTE_LOCATIONS_MUST_DIFFER','DRIVER_REQUIRED_FOR_SHIPMENT'].includes(error.code))return failure(400,'INVALID_TRACKING_SESSION','Check the shipment details and try again.');
   if(['NOT_FOUND','TRACKING_SESSION_NOT_FOUND'].includes(error.code))return failure(404,'TRACKING_SESSION_NOT_FOUND','This shipment is not available.');
   if(['TRACKING_SESSION_CHANGED','TRACKING_SESSION_CONNECTED','TRACKING_SESSION_ALREADY_CONNECTED','TRACKING_SHARING_CHANGED','TRACKING_RECIPIENT_LIMIT','TRACKING_ALREADY_EXISTS','REVIEW_ALREADY_SUBMITTED','TRACKING_HANDOVER_PROOF_REQUIRED','TRACKING_NOT_READY_FOR_APPROVAL'].includes(error.code))return failure(409,error.code,'This session changed or is not ready for this action. Reload its current details.');
  }
  return failure(503,'TRACKING_UNAVAILABLE','Tracking is temporarily unavailable. Please try again.');
 }
}
