import {businessActor,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {trackingSharingId,trackingSharingFailure} from '@/lib/tracking-sharing/http';
import {getBusinessTrackingDetail} from '@/lib/tracking-sharing/server';
import {guestTrackingDetail} from '@/lib/mobile/tracking-contract';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string;shipmentId:string}>}){try{
 const actor=await businessActor(request),values=await params,id=trackingSharingId(values.workspaceId),shipment=trackingSharingId(values.shipmentId);
 await businessLimit(actor,'tracking-detail',120);
 const result=await getBusinessTrackingDetail(actor,id,shipment);
 return businessJson({...guestTrackingDetail(result.shipment),workspaceId:id,isOwner:result.isOwner,
  canViewLocation:result.shipment.can_view_location,ownerActionsRequireVerification:true});
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
