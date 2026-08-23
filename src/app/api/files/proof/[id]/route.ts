import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { getProofFile } from '@/lib/repository.js';
import { readPrivateUpload } from '@/lib/private-storage.js';

export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const {id}=await params;const proof=await getProofFile(user,id);if(!proof)return NextResponse.json({error:'Not found'},{status:404});const bytes=await readPrivateUpload(proof.file_path);if(!bytes)return NextResponse.json({error:'Not found'},{status:404});return new NextResponse(bytes,{headers:{'Content-Type':proof.mime_type,'Content-Disposition':`inline; filename="${String(proof.original_name).replaceAll('"','')}"`,'Cache-Control':'private, no-store'}});}
