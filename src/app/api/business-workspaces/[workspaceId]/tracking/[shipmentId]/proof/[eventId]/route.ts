import {NextResponse} from 'next/server.js';
import {businessActorIdentity,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {trackingSharingFailure,trackingSharingId} from '@/lib/tracking-sharing/http';
import {TrackingSharingError} from '@/lib/tracking-sharing/domain';
import {getBusinessTrackingDetail} from '@/lib/tracking-sharing/server';
import {accountOwnerVerification} from '@/lib/tracking-sharing/account-owner';
import {readProviderTrackingProof} from '@/lib/provider-tracking.js';
import {privateDocumentHeaders} from '@/lib/private-storage.js';
import {privateFilePayload} from '@/lib/mobile/file-contract.js';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string;shipmentId:string;eventId:string}>}){try{
 const actor=await businessActorIdentity(request),{workspaceId,shipmentId,eventId}=await params;
 const workspace=trackingSharingId(workspaceId),shipment=trackingSharingId(shipmentId),event=trackingSharingId(eventId);
 const detail=await getBusinessTrackingDetail(actor.id,workspace,shipment);
 const proof=accountOwnerVerification(actor.email,detail.isOwner);
 await businessLimit(actor.id,`tracking-proof:${shipment}`,60);
 const file=await readProviderTrackingProof(null,shipment,event,proof.digest);
 if(!file)throw new TrackingSharingError('NOT_FOUND');
 if(new URL(request.url).searchParams.get('format')==='base64')return businessJson(privateFilePayload(file.bytes,file.mimeType));
 return new NextResponse(file.bytes,{headers:privateDocumentHeaders(file.mimeType,file.originalName)});
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
