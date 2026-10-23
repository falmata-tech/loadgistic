import {businessActor,businessJson,businessLimit,BusinessHttpError} from '@/lib/business-workspaces/http';
import {directorySearch} from '@/lib/business-directory/domain.js';
import {supabaseBusinessDirectoryPort} from '@/lib/business-directory/supabase';
import {directoryFailure} from '@/lib/business-directory/http';
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const actorId=await businessActor(request);await businessLimit(actorId,'provider-directory',120);
  const query=new URL(request.url).searchParams;
  if([...query.keys()].some(key=>!['q','page'].includes(key))||query.getAll('q').length>1||query.getAll('page').length>1)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
  const input=directorySearch(query.get('q')||'',query.get('page')||'1');
  return businessJson(await supabaseBusinessDirectoryPort().search(actorId,input.query,input.page));
 }catch(error){return directoryFailure(error);}
}
