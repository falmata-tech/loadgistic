import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {correctWorkspace} from '@/lib/lifecycle.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
 const {id}=await params;const form=await request.formData();const kind=text(form,'kind');
 const returnTo=`/admin/operations/workspaces/${id}?kind=${encodeURIComponent(kind)}`;
 try{
  if([...form.keys()].length!==new Set(form.keys()).size)throw new Error('INVALID_WORKSPACE_CORRECTION');
  await correctWorkspace(user,id,Object.fromEntries(form));return redirectWith(request,returnTo,'success','Business name corrected.');
 }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
