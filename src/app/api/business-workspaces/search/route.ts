import {businessActor,businessFailure,businessJson,businessLimit,businessService,BusinessHttpError} from '@/lib/business-workspaces/http';
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'search',90);
  const query=new URL(request.url).searchParams;
  if([...query.keys()].some(key=>key!=='q')||query.getAll('q').length>1)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
  return businessJson(await businessService().search(actorId,query.get('q')||''));
 }catch(error){return businessFailure(error);}
}
