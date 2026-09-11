import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser,getGuestSupportSession} from '@/lib/auth';
import {readGuestSupportAttachment} from '@/lib/support.js';

export const runtime='nodejs';
function safeName(value:string){return String(value||'attachment').replace(/[\r\n"\\]/g,'_').slice(0,160);}

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;attachmentId:string}>}){
  const {id,attachmentId}=await params;const session=await getGuestSupportSession(id);const user=session?null:await getCurrentUser({allowLimited:true});
  if(!session&&!user)return new NextResponse('Not found',{status:404});
  try{const file=await readGuestSupportAttachment(user,id,attachmentId,session?.emailDigest||null);return new NextResponse(file.bytes,{headers:{'Content-Type':file.mimeType,'Content-Disposition':`attachment; filename="${safeName(file.originalName)}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  catch{return new NextResponse('Not found',{status:404});}
}
