import fs from 'node:fs';
import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { getLoadProofFile } from '@/lib/repository.js';

export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser(); if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params; const proof=getLoadProofFile(user,id);
  if(!proof||!fs.existsSync(proof.file_path))return NextResponse.json({error:'Not found'},{status:404});
  return new NextResponse(fs.readFileSync(proof.file_path),{headers:{'Content-Type':proof.mime_type,'Content-Disposition':`inline; filename="${String(proof.original_name).replaceAll('"','')}"`,'Cache-Control':'private, no-store'}});
}
