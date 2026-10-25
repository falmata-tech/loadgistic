import {businessActor,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {directorySearch,BusinessDirectoryError} from '@/lib/business-directory/domain.js';
import {accountDirectoryPort,AccountDirectoryError} from '@/lib/account-directory';
export const runtime='nodejs';
function directoryResponse(error:unknown){
 if(error instanceof BusinessHttpError)return businessJson({error:{code:error.code,message:error.message}},error.status);
 const code=error instanceof BusinessDirectoryError?'DIRECTORY_INVALID_INPUT':error instanceof AccountDirectoryError?error.code:'DIRECTORY_UNAVAILABLE';
 const status=code==='DIRECTORY_FORBIDDEN'?403:code==='DIRECTORY_INVALID_INPUT'||code==='DIRECTORY_INVALID_TARGET'?400:code==='DIRECTORY_NOT_FOUND'?404:503;
 const message=code==='DIRECTORY_FORBIDDEN'?'Open an active workspace to continue.':code==='DIRECTORY_INVALID_INPUT'||code==='DIRECTORY_INVALID_TARGET'?'Choose an available account and try again.':code==='DIRECTORY_NOT_FOUND'?'That request is no longer available.':'Network is temporarily unavailable. Try again.';
 return businessJson({error:{code,message}},status);
}
export async function GET(request:Request){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'account-directory',120);
  const params=new URL(request.url).searchParams;
  if([...params.keys()].some(key=>!['q','page'].includes(key))||params.getAll('q').length>1||params.getAll('page').length>1)throw new AccountDirectoryError('DIRECTORY_INVALID_INPUT');
  const input=directorySearch(params.get('q')||'',params.get('page')||'1');
  return businessJson(await accountDirectoryPort().search(actorId,input.query,input.page));
 }catch(error){return directoryResponse(error);}
}
