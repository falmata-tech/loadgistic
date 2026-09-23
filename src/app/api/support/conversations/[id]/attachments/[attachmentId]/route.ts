import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {readSupportAttachment} from '@/lib/support-attachments.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;attachmentId:string}>}){
  const user=await getCurrentUser({allowLimited:true});if(!user)return new NextResponse('Not found',{status:404,headers});
  const {id,attachmentId}=await params;
  try{
    const file=await readSupportAttachment(user,id,attachmentId);
    const name=file.originalName.replace(/[\r\n"\\]/g,'_');
    return new NextResponse(file.bytes,{headers:{...headers,'Content-Type':file.mimeType,'Content-Disposition':`attachment; filename="${name}"`}});
  }catch{return new NextResponse('Not found',{status:404,headers});}
}
