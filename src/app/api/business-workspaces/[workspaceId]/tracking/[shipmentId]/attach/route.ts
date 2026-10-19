import {businessActor,businessBody,businessFailure,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {trackingSharingId,trackingOwnerVerification,trackingSharingFailure} from '@/lib/tracking-sharing/http';
import {trackingSharingService} from '@/lib/tracking-sharing/server';
import {attachTrackingBusiness} from '@/lib/tracking-sharing/domain';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{workspaceId:string;shipmentId:string}>}){try{
 const actor=await businessActor(request),values=await params,id=trackingSharingId(values.workspaceId),shipment=trackingSharingId(values.shipmentId);
 await businessLimit(actor,'tracking-attach',20);
 const parsed=attachTrackingBusiness.safeParse(await businessBody(request));if(!parsed.success)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
 const proof=await trackingOwnerVerification(request,shipment,false,parsed.data.ownerVerification);
 return businessJson(await trackingSharingService().attach(actor,id,shipment,proof,parsed.data.expectedRevision));
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
