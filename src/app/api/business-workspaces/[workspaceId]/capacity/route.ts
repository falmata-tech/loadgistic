import {businessActor,businessFailure,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {businessId} from '@/lib/business-workspaces/domain.js';
import {listBusinessCapacity} from '@/lib/business-capacity/supabase';
import {capacityFilterParams} from '@/lib/capacity-filter-values.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string}>}){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'capacity-feed',120);
  const workspaceId=businessId((await params).workspaceId),query=new URL(request.url).searchParams;
  let filters:Record<string,string>;
  try{filters={...Object.fromEntries(query),...capacityFilterParams(query)};}
  catch{throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');}
  if((filters.q||'').length>120||(filters.cursor||'').length>512)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
  return businessJson(await listBusinessCapacity(actorId,workspaceId,filters));
 }catch(error){return businessFailure(error);}
}
