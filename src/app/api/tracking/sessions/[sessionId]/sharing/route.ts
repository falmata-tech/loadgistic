import {businessActorIdentity,businessBody,businessFailure,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {trackingSessionId} from '@/lib/tracking-sessions/contracts';
import {trackingSessionService} from '@/lib/tracking-sessions/supabase';
import {accountOwnerVerification} from '@/lib/tracking-sharing/account-owner';
import {trackingSharingService} from '@/lib/tracking-sharing/server';
import {trackingSharingFailure} from '@/lib/tracking-sharing/http';
import {getProviderGuestTracking} from '@/lib/provider-tracking.js';
import {providerTrackingRecipientDigest} from '@/lib/security.js';
export const runtime='nodejs';
type Context={params:Promise<{sessionId:string}>};
async function verifiedOwner(request:Request,context:Context){
 const actor=await businessActorIdentity(request),{sessionId}=await context.params;
 if(!trackingSessionId.safeParse(sessionId).success)throw new BusinessHttpError(404,'NOT_FOUND');
 const session=await trackingSessionService().detail(actor.id,sessionId);
 if(session.capabilities.canManageTeam!==true)throw new BusinessHttpError(403,'BUSINESS_FORBIDDEN');
 if(!session.shipmentId)throw new BusinessHttpError(404,'NOT_FOUND');
 const owner=await getProviderGuestTracking(session.shipmentId,providerTrackingRecipientDigest(actor.email));
 if(owner?.recipient_role!=='OWNER')throw new BusinessHttpError(403,'BUSINESS_FORBIDDEN');
 return {actor,shipmentId:session.shipmentId,proof:accountOwnerVerification(actor.email,true)};
}
export async function GET(request:Request,context:Context){try{
 const owner=await verifiedOwner(request,context);return businessJson(await trackingSharingService().owner(owner.shipmentId,owner.proof));
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
export async function POST(request:Request,context:Context){try{
 const owner=await verifiedOwner(request,context);await businessLimit(owner.actor.id,'tracking-team-access',20);
 const input=await businessBody(request);if(input.action==='ADD_VIEWER')throw new BusinessHttpError(410,'TRACKING_LINK_REQUIRED');
 return businessJson(await trackingSharingService().command(owner.shipmentId,owner.proof,input));
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
