import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser,getProviderTrackingGrant} from '@/lib/auth';
import {readProviderTrackingProof} from '@/lib/provider-tracking.js';
import {privateDocumentHeaders} from '@/lib/private-storage.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){
  const {id,eventId}=await params;
  const missing=()=>NextResponse.json({error:'Proof is unavailable or access has expired.'},{status:404,headers:{'Cache-Control':'private, no-store'}});
  if(!uuid.test(id)||!uuid.test(eventId))return missing();
  const [user,grant]=await Promise.all([getCurrentUser({allowLimited:true}),getProviderTrackingGrant(id)]);
  if(!user&&!grant)return missing();
  try{
    const file=await readProviderTrackingProof(user,id,eventId,grant?.recipientDigest||null);
    if(!file)return missing();
    return new NextResponse(file.bytes,{headers:privateDocumentHeaders(file.mimeType,file.originalName)});
  }catch{
    return NextResponse.json({error:'The proof could not be opened. Please retry.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
