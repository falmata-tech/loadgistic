import {NextResponse} from 'next/server.js';
import {getPublicDriverPortraitFile} from '@/lib/driver-portrait-storage.js';
import {readPrivateUpload} from '@/lib/private-storage.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  try{
    const file=await getPublicDriverPortraitFile(id);
    const bytes=file?await readPrivateUpload(file.file_path,{timeoutMs:30000}):null;
    if(!bytes)return NextResponse.json({error:'Not found'},{status:404,headers});
    return new NextResponse(bytes,{headers:{...headers,'Content-Type':'image/jpeg','Content-Disposition':'inline'}});
  }catch{return NextResponse.json({error:'Image temporarily unavailable'},{status:503,headers});}
}
