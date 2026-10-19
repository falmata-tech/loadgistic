import {businessFailure,businessJson} from '@/lib/business-workspaces/http';
import {businessSearchResult} from '@/lib/business-capacity/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string}>}){
 try{return businessJson(await businessSearchResult(request,(await params).workspaceId));}catch(error){return businessFailure(error);}
}
