import {businessActor,businessBody,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {businessId,BusinessWorkspaceError} from '@/lib/business-workspaces/domain.js';
import {accountDirectoryPort,AccountDirectoryError} from '@/lib/account-directory';

export const runtime='nodejs';
type Context={params:Promise<{workspaceId:string}>};
function failure(error:unknown){
 if(error instanceof BusinessHttpError)return businessJson({error:{code:error.code,message:error.message}},error.status);
 const code=error instanceof AccountDirectoryError?error.code:error instanceof BusinessWorkspaceError?error.code:'DIRECTORY_UNAVAILABLE';
 const status=code==='NETWORK_FORBIDDEN'?403:code==='NETWORK_INVALID_INPUT'||code==='INVALID_BUSINESS_INPUT'?400:code==='NETWORK_REVISION_CONFLICT'?409:503;
 const message=status===403?'Only the workspace owner can change this setting.':status===400?'Check the setting and try again.':status===409?'This account changed. Refresh and try again.':'Could not load this setting. Try again.';
 return businessJson({error:{code,message}},status);
}
export async function GET(request:Request,context:Context){
 try{const actorId=await businessActor(request),{workspaceId}=await context.params;
  await businessLimit(actorId,'account-directory',120);
  return businessJson(await accountDirectoryPort().networkPreference(actorId,businessId(workspaceId)));
 }catch(error){return failure(error);}
}
export async function POST(request:Request,context:Context){
 try{const actorId=await businessActor(request),{workspaceId}=await context.params;
  await businessLimit(actorId,'team-command',30);
  const body=await businessBody(request);
  if(Object.keys(body).sort().join(',')!=='expectedVersion,visible'||typeof body.visible!=='boolean'||!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)throw new AccountDirectoryError('NETWORK_INVALID_INPUT');
  return businessJson(await accountDirectoryPort().setNetworkPreference(actorId,businessId(workspaceId),body.visible,body.expectedVersion));
 }catch(error){return failure(error);}
}
