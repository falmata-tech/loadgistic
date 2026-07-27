import fs from 'node:fs';
import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { getVerificationFile } from '@/lib/repository.js';

export const runtime='nodejs';

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const file=getVerificationFile(user,id);
  if(!file||!fs.existsSync(file.file_path))return NextResponse.json({error:'Not found'},{status:404});
  return new NextResponse(fs.readFileSync(file.file_path),{headers:{'Content-Type':file.mime_type,'Content-Disposition':`inline; filename="${String(file.original_name).replaceAll('"','')}"`,'Cache-Control':'private, no-store'}});
}
