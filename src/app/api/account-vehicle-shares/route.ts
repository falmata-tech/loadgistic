import {businessActor,businessBody,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {accountDirectoryPort,AccountDirectoryError} from '@/lib/account-directory';
export const runtime='nodejs';
function failure(error:unknown){
 if(error instanceof BusinessHttpError)return businessJson({error:{code:error.code,message:error.message}},error.status);
 const code=error instanceof AccountDirectoryError?error.code:'DIRECTORY_UNAVAILABLE';
 const status=code==='DIRECTORY_FORBIDDEN'?403:code==='DIRECTORY_INVALID_INPUT'||code==='EXCLUSIVE_RECIPIENT_ONLY'?400:code==='DIRECTORY_REVISION_CONFLICT'?409:503;
 const message=code==='DIRECTORY_FORBIDDEN'?'You cannot share or remove access for this vehicle.':code==='EXCLUSIVE_RECIPIENT_ONLY'?'This vehicle is set to one exclusive email. Change its sharing setting first.':code==='DIRECTORY_REVISION_CONFLICT'?'Sharing changed elsewhere. Refresh and try again.':code==='DIRECTORY_INVALID_INPUT'?'Choose a vehicle and connection.':'Vehicle sharing is temporarily unavailable.';
 return businessJson({error:{code,message}},status);
}
export async function POST(request:Request){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'account-vehicle-share',30);
  const body=await businessBody(request);
  if(Object.keys(body).sort().join(',')==='action,grantId,revision'&&body.action==='REVOKE')
   return businessJson(await accountDirectoryPort().revokeVehicle(actorId,body.grantId,body.revision));
  if(Object.keys(body).sort().join(',')!=='action,connectionId,vehicleId'||body.action!=='GRANT')throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
  return businessJson(await accountDirectoryPort().grantVehicle(actorId,body.connectionId,body.vehicleId));
 }catch(error){return failure(error);}
}
export async function PATCH(request:Request){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'account-vehicle-revoke',30);
  const body=await businessBody(request);if(Object.keys(body).sort().join(',')!=='action,grantId,revision'||body.action!=='REVOKE')throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
  return businessJson(await accountDirectoryPort().revokeVehicle(actorId,body.grantId,body.revision));
 }catch(error){return failure(error);}
}
