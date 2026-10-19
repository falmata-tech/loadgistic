import {businessActor,businessBody,businessFailure,businessJson,businessLimit,businessService,businessInviteDelivery,BusinessHttpError} from '@/lib/business-workspaces/http';
import {businessId} from '@/lib/business-workspaces/domain.js';
export const runtime='nodejs';
type Context={params:Promise<{workspaceId:string}>};
export async function GET(request:Request,context:Context){
 try{const actorId=await businessActor(request),{workspaceId}=await context.params;await businessLimit(actorId,'directory',120);return businessJson(await businessService().directory(actorId,workspaceId));}
 catch(error){return businessFailure(error);}
}
export async function POST(request:Request,context:Context){
 try{
  const actorId=await businessActor(request),{workspaceId}=await context.params;await businessLimit(actorId,'team-command',30);
  const body=await businessBody(request);
  if(body.action==='RESEND_INVITATION'){
   if(Object.keys(body).some(key=>!['action','invitationId'].includes(key)))throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
   const invitationId=businessId(body.invitationId);return businessJson({invitationId,delivery:await businessInviteDelivery(actorId,businessId(workspaceId),invitationId)});
  }
  const result=await businessService().command(actorId,workspaceId,body);
  if(result.action==='INVITE'&&result.invitationId){
   try{return businessJson({...result,delivery:await businessInviteDelivery(actorId,workspaceId,result.invitationId)});}
   catch{return businessJson({...result,delivery:'FAILED'});}
  }
  return businessJson(result);
 }
 catch(error){return businessFailure(error);}
}
