import {businessActor,businessBody,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {businessCapacitySharingPort} from '@/lib/business-capacity/supabase';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'capacity-share',30);
  return businessJson(await businessCapacitySharingPort().command(actorId,await businessBody(request)));
 }catch(error){return businessFailure(error);}
}
