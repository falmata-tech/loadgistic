import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { getVerificationFile } from '@/lib/verification.js';
import { readPrivateUpload } from '@/lib/private-storage.js';

export const runtime='nodejs';

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const file=await getVerificationFile(user,id);
  if(!file)return NextResponse.json({error:'Not found'},{status:404});
  const bytes=await readPrivateUpload(file.file_path);
  if(!bytes)return NextResponse.json({error:'Not found'},{status:404});
  return new NextResponse(bytes,{headers:{'Content-Type':file.mime_type,'Content-Disposition':`inline; filename="${String(file.original_name).replaceAll('"','')}"`,'Cache-Control':'private, no-store'}});
}
