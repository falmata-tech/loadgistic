import {z} from 'zod';
import {getProviderTrackingGrant} from '../auth';
import {requireVisitor} from '../mobile/visitor-server';
import {MobileError,mobileFailure} from '../mobile/server';
import {mutationOriginAllowed} from '../origin.js';
import {businessJson,BusinessHttpError} from '../business-workspaces/http';
import {TrackingSharingError,type OwnerVerification} from './domain';

export function trackingSharingId(value:unknown){const result=z.string().uuid().safeParse(value);if(!result.success)throw new TrackingSharingError('NOT_FOUND');return result.data;}
export async function trackingOwnerVerification(request:Request,shipmentId:string,mobile=false,token?:string):Promise<OwnerVerification>{
 if(!['GET','HEAD'].includes(request.method)&&!mutationOriginAllowed(request.headers,request.url))throw new BusinessHttpError(403,'INVALID_ORIGIN');
 if(mobile||token){
  const session=await requireVisitor(token?new Request(request.url,{headers:{Authorization:`Bearer ${token}`}}):request,'tracking');
  return{digest:session.digest,startedAt:session.startedAt};
 }
 const grant=await getProviderTrackingGrant(shipmentId);if(!grant)throw new TrackingSharingError('TRACKING_SESSION_EXPIRED');
 return{digest:grant.recipientDigest,startedAt:grant.startedAt};
}
export function trackingSharingFailure(error:unknown){
 if(error instanceof MobileError)return mobileFailure(error);
 if(error instanceof TrackingSharingError){const status=error.code==='TRACKING_SESSION_EXPIRED'?401:error.code==='TRACKING_UNAVAILABLE'?503:
  error.code==='TRACKING_SHARING_CHANGED'?409:error.code==='NOT_FOUND'?404:['TRACKING_APPROVAL_FORBIDDEN','TRACKING_ACCESS_DENIED','BUSINESS_FORBIDDEN'].includes(error.code)?403:400;
  const messages:Record<string,string>={TRACKING_SESSION_EXPIRED:'Verify your email again to manage sharing.',TRACKING_APPROVAL_FORBIDDEN:'Only the shipment owner can manage sharing.',
   TRACKING_SHARING_CHANGED:'Sharing changed. Refresh before trying again.',TRACKING_RECIPIENT_EXISTS:'This email already has access.',TRACKING_RECIPIENT_LIMIT:'Remove an existing viewer before adding another.',
   TRACKING_RECIPIENTS_CLOSED:'This shipment is no longer accepting new viewers.',INVALID_TRACKING_RECIPIENTS:'Check the name and email, then try again.',BUSINESS_FORBIDDEN:'This business or team member is no longer available.'};
  return businessJson({error:{code:error.code,message:messages[error.code]||'This shipment is not available. Please refresh and try again.'}},status);
 }
 return null;
}
