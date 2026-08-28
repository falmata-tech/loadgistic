import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { getPaymentProofFile } from '@/lib/billing.js';
import { readPrivateUpload } from '@/lib/private-storage.js';

export const runtime='nodejs';

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const proof=await getPaymentProofFile(user,id);
  if(!proof)return NextResponse.json({error:'Not found'},{status:404});
  const bytes=await readPrivateUpload(proof.file_path);
  if(!bytes)return NextResponse.json({error:'Not found'},{status:404});
  const originalName=String(proof.original_name||'payment-proof').replaceAll('"','');
  return new NextResponse(bytes,{headers:{
    'Content-Type':proof.mime_type||'application/octet-stream',
    'Content-Disposition':`inline; filename="${originalName}"`,
    'Cache-Control':'private, no-store'
  }});
}
