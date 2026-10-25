import {businessActor,businessBody,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {accountDirectoryPort,AccountDirectoryError} from '@/lib/account-directory';
export const runtime='nodejs';
function failure(error:unknown){
 if(error instanceof BusinessHttpError)return businessJson({error:{code:error.code,message:error.message}},error.status);
 const code=error instanceof AccountDirectoryError?error.code:'DIRECTORY_UNAVAILABLE';
 const status=code==='DIRECTORY_FORBIDDEN'?403:code==='DIRECTORY_INVALID_INPUT'||code==='DIRECTORY_INVALID_TARGET'?400:code==='DIRECTORY_NOT_FOUND'?404:503;
 return businessJson({error:{code,message:code==='DIRECTORY_FORBIDDEN'?'This account cannot manage that request.':code==='DIRECTORY_INVALID_INPUT'||code==='DIRECTORY_INVALID_TARGET'?'Choose an available account and try again.':code==='DIRECTORY_NOT_FOUND'?'That request is no longer available.':'Connections are temporarily unavailable. Try again.'}},status);
}
export async function GET(request:Request){
 try{const actorId=await businessActor(request);await businessLimit(actorId,'account-connections',120);
  if(new URL(request.url).search)return businessJson({error:{code:'DIRECTORY_INVALID_INPUT',message:'Check the request and try again.'}},400);
  return businessJson({items:await accountDirectoryPort().connections(actorId)});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{const actorId=await businessActor(request);await businessLimit(actorId,'account-request',20);
  const body=await businessBody(request);
  if(Object.keys(body).sort().join(',')==='action,decision,id'&&body.action==='DECIDE')return businessJson(await accountDirectoryPort().decide(actorId,body.id,body.decision));
  if(Object.keys(body).sort().join(',')!=='kind,targetId')throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
  return businessJson(await accountDirectoryPort().request(actorId,body.kind,body.targetId));
 }catch(error){return failure(error);}
}
export async function PATCH(request:Request){
 try{const actorId=await businessActor(request);await businessLimit(actorId,'account-decision',30);
  const body=await businessBody(request);if(Object.keys(body).sort().join(',')!=='decision,id')throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
  return businessJson(await accountDirectoryPort().decide(actorId,body.id,body.decision));
 }catch(error){return failure(error);}
}
