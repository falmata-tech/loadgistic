import {businessActorIdentity,businessBody,businessFailure,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {trackingSharingId,trackingSharingFailure} from '@/lib/tracking-sharing/http';
import {trackingSharingService} from '@/lib/tracking-sharing/server';
import {attachTrackingBusiness} from '@/lib/tracking-sharing/domain';
import {accountOwnerVerification} from '@/lib/tracking-sharing/account-owner';
import {providerTrackingRecipientDigest} from '@/lib/security.js';
import {getProviderGuestTracking} from '@/lib/provider-tracking.js';
import {trackingSessionService} from '@/lib/tracking-sessions/supabase';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{workspaceId:string;shipmentId:string}>}){try{
 const actor=await businessActorIdentity(request),values=await params,id=trackingSharingId(values.workspaceId),shipment=trackingSharingId(values.shipmentId);
 await businessLimit(actor.id,'tracking-attach',20);
 const parsed=attachTrackingBusiness.safeParse(await businessBody(request));if(!parsed.success)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
 if(parsed.data.ownerVerification)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
 const session=await trackingSessionService().fromShipment(actor.id,shipment,null);
 if(session.capabilities.canManageTeam!==true)throw new BusinessHttpError(403,'BUSINESS_FORBIDDEN');
 const owner=await getProviderGuestTracking(shipment,providerTrackingRecipientDigest(actor.email));
 if(owner?.recipient_role!=='OWNER')throw new BusinessHttpError(403,'BUSINESS_FORBIDDEN');
 const proof=accountOwnerVerification(actor.email,true);
 return businessJson(await trackingSharingService().attach(actor.id,id,shipment,proof,parsed.data.expectedRevision));
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
