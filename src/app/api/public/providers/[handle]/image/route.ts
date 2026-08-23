import { NextResponse } from 'next/server.js';
import { getPublicProviderProfileImage } from '@/lib/repository.js';
import { readPrivateUpload } from '@/lib/private-storage.js';

export async function GET(_:Request,{params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;
  const image=await getPublicProviderProfileImage(handle);
  if(!image)return NextResponse.json({error:'Not found'},{status:404});
  const bytes=await readPrivateUpload(image.file_path);
  if(!bytes)return NextResponse.json({error:'Not found'},{status:404});
  return new NextResponse(bytes,{headers:{'Content-Type':image.mime_type,'Content-Disposition':'inline','Cache-Control':'public, max-age=300, must-revalidate','X-Content-Type-Options':'nosniff'}});
}
