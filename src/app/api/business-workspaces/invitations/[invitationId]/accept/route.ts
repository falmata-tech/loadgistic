import {businessActor,businessBody,businessFailure,businessJson,businessLimit,businessService,BusinessHttpError} from '@/lib/business-workspaces/http';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{invitationId:string}>}){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'accept',20);
  if(Object.keys(await businessBody(request)).length)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
  const {invitationId}=await context.params;return businessJson(await businessService().accept(actorId,invitationId));
 }catch(error){return businessFailure(error);}
}
