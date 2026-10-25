import {createClient} from '@supabase/supabase-js';
import {createSupabaseServerClient} from '../supabase/server';
import {getSupabasePublicConfig} from '../supabase/config';
import {checkRateLimit} from '../rate-limit.js';
import {mutationOriginAllowed} from '../origin.js';
import {contentPolicyAccepted} from '../privacy/content-policy.js';
import {reviewAccountAllowed} from '../privacy/review-access.js';
import {BusinessWorkspaceError} from './domain.js';
import {businessWorkspaceService} from './application';
import {supabaseBusinessWorkspacePort} from './supabase';
import {deliverBusinessInvitation} from './invitation-email';

export class BusinessHttpError extends Error {constructor(public status:number,public code:string){super(code);}}
export function businessJson(value:unknown,status=200):Response {
 return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store',Vary:'Cookie, Authorization','X-Robots-Tag':'noindex, nofollow, nosnippet, noimageindex'}});
}
export function businessFailure(error:unknown):Response {
 if(error instanceof BusinessHttpError)return businessJson({error:{code:error.code,message:messages[error.code]||'Please try again.'}},error.status);
 if(error instanceof BusinessWorkspaceError){
  const status=error.code==='INVALID_BUSINESS_INPUT'||error.code==='INVALID_ACCOUNT_HANDLE'?400:error.code==='BUSINESS_FORBIDDEN'||error.code==='BUSINESS_IDENTITY_REQUIRED'?403:
   error.code==='BUSINESS_UNAVAILABLE'?503:409;
  return businessJson({error:{code:error.code,message:messages[error.code]||'The request could not be completed. Refresh and try again.'}},status);
 }
 return businessJson({error:{code:'BUSINESS_UNAVAILABLE',message:'This workspace is temporarily unavailable. Please try again.'}},503);
}
const messages:Record<string,string>={SIGN_IN_REQUIRED:'Sign in to continue.',VERIFIED_EMAIL_REQUIRED:'Verify your email to continue.',INVALID_ORIGIN:'Use this app to save changes.',
 INVALID_BUSINESS_INPUT:'Check the information and try again.',ACCOUNT_HANDLE_UNAVAILABLE:'That handle is already in use. Choose another.',INVALID_ACCOUNT_HANDLE:'Choose a valid handle using lowercase letters, numbers, underscores or hyphens.',BUSINESS_FORBIDDEN:'You do not have access to this workspace.',BUSINESS_IDENTITY_REQUIRED:'This account cannot access a shipper or broker workspace.',
 BUSINESS_REVISION_CONFLICT:'This workspace changed. Refresh before saving.',BUSINESS_HANDLE_UNAVAILABLE:'That workspace handle is already in use.',
 BUSINESS_OWNER_HANDOVER_REQUIRED:'Transfer ownership or archive the workspace before leaving.',BUSINESS_INVITATION_UNAVAILABLE:'This invitation is no longer available.',
 RATE_LIMITED:'Please wait before trying again.',POLICY_REQUIRED:'Read and accept the current terms before continuing.'};

export async function businessActorIdentity(request:Request):Promise<{id:string;email:string}>{
 const authorization=request.headers.get('authorization');let client;
 if(authorization!==null){
  const match=authorization.match(/^Bearer ([^\s]+)$/i);if(!match)throw new BusinessHttpError(401,'SIGN_IN_REQUIRED');
  const {url,publishableKey}=getSupabasePublicConfig();
  client=createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${match[1]}`}}});
 }else client=await createSupabaseServerClient();
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)throw new BusinessHttpError(401,'SIGN_IN_REQUIRED');
 if(!data.user.email||!data.user.email_confirmed_at)throw new BusinessHttpError(403,'VERIFIED_EMAIL_REQUIRED');
 if(data.user.app_metadata?.loadgistic_review===true&&!await reviewAccountAllowed(data.user.id))throw new BusinessHttpError(403,'BUSINESS_IDENTITY_REQUIRED');
 if(!['GET','HEAD'].includes(request.method)){
  if(!mutationOriginAllowed(request.headers,request.url))throw new BusinessHttpError(403,'INVALID_ORIGIN');
  if(!await contentPolicyAccepted(data.user.id))throw new BusinessHttpError(403,'POLICY_REQUIRED');
 }
 return {id:data.user.id,email:data.user.email.trim().toLowerCase()};
}
export async function businessActor(request:Request):Promise<string>{return (await businessActorIdentity(request)).id;}
export async function businessLimit(actorId:string,scope:string,limit=30):Promise<void>{
 if(!(await checkRateLimit(`business-workspace:${scope}:${actorId}`,limit,60_000)).allowed)throw new BusinessHttpError(429,'RATE_LIMITED');
}
export async function businessBody(request:Request):Promise<Record<string,unknown>> {
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new BusinessHttpError(415,'INVALID_BUSINESS_INPUT');
 const reader=request.body?.getReader();if(!reader)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
 let size=0;const parts:Uint8Array[]=[];
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new BusinessHttpError(413,'INVALID_BUSINESS_INPUT');}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const input:unknown=JSON.parse(new TextDecoder().decode(bytes));
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
  return input as Record<string,unknown>;
 }catch(error){if(error instanceof BusinessHttpError)throw error;throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');}
 finally{reader.releaseLock();}
}
export function businessService(){return businessWorkspaceService(supabaseBusinessWorkspacePort());}
export function businessInviteDelivery(actorId:string,workspaceId:string,invitationId:string){return deliverBusinessInvitation(supabaseBusinessWorkspacePort(),actorId,workspaceId,invitationId);}
