import {businessSearchResult} from '@/lib/business-capacity/http';
import {businessFailure,businessJson} from '@/lib/business-workspaces/http';
import {discoveryProfiles} from '@/lib/mobile/discovery-contract.js';
import {VEHICLE_CONFIGURATIONS} from '@/lib/vehicle-configurations';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string}>}){
 try{return businessJson({...discoveryProfiles(await businessSearchResult(request,(await params).workspaceId)),configurations:VEHICLE_CONFIGURATIONS});}catch(error){return businessFailure(error);}
}
