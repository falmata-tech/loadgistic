import {businessActor,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {trackingSharingId,trackingSharingFailure} from '@/lib/tracking-sharing/http';
import {listBusinessTracking} from '@/lib/tracking-sharing/server';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string}>}){try{
 const actor=await businessActor(request),id=trackingSharingId((await params).workspaceId),value=Number(new URL(request.url).searchParams.get('page')||1);
 await businessLimit(actor,'tracking-list',120);
 return businessJson(await listBusinessTracking(actor,id,Number.isSafeInteger(value)&&value>0?value:1));
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
