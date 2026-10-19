import {businessActor,businessBody,businessFailure,businessJson,businessLimit,businessService,BusinessHttpError} from '@/lib/business-workspaces/http';
export const runtime='nodejs';
export async function GET(request:Request){
 try{const actorId=await businessActor(request);await businessLimit(actorId,'context',120);return businessJson(await businessService().context(actorId));}
 catch(error){return businessFailure(error);}
}
export async function POST(request:Request){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'create-select',20);
  const body=await businessBody(request);
  if(body.action==='CREATE'){
   const {action,...input}=body;return businessJson(await businessService().create(actorId,input),201);
  }
  if(body.action==='SELECT'&&Object.keys(body).every(key=>['action','workspaceId'].includes(key))){const selected=await businessService().select(actorId,body.workspaceId);return businessJson(selected||{selectedWorkspaceId:null});}
  throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
 }catch(error){return businessFailure(error);}
}
