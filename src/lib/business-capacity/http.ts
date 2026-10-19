import {businessActor,businessLimit,BusinessHttpError} from '../business-workspaces/http';
import {businessCapacitySearchPort} from './supabase';
export async function businessSearchResult(request:Request,workspaceId:string){
 const actorId=await businessActor(request);await businessLimit(actorId,'capacity-search',90);
 const params=new URL(request.url).searchParams;
 // Search is independent of map filters. Old clients may submit other map
 // parameters, but only text/page influence this authorized profile search.
 if(params.getAll('q').length>1||params.getAll('page').length>1)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
 const page=Number(params.get('page')||1);
 return businessCapacitySearchPort().search(actorId,workspaceId,params.get('q')||'',page);
}
