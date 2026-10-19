import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {correctWorkspace} from '@/lib/lifecycle.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
import {adminOperationReturnPath} from '@/lib/admin-account-navigation.js';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
 const {id}=await params;const form=await request.formData();const kind=text(form,'kind');
 const returnTo=adminOperationReturnPath(text(form,'returnTo'))||`/admin/operations/workspaces/${id}?kind=${encodeURIComponent(kind)}`;
 try{
  if([...form.keys()].length!==new Set(form.keys()).size)throw new Error('INVALID_WORKSPACE_CORRECTION');
  const command=Object.fromEntries(form);delete command.returnTo;
  await correctWorkspace(user,id,command);return redirectWith(request,returnTo,'success','Business name corrected.');
 }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
