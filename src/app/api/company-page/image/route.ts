import {workspaceFormReturnPath} from '@/lib/workspace-form-navigation.js';
import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { readOwnProviderProfileImage,removeProviderProfileImage,updateProviderProfileImage } from '@/lib/provider-profile.js';
import { redirectWith,text } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export async function GET(request:Request){
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  if(!user.active||!['DRIVER','TRANSPORTER'].includes(user.role)||user.driver_kind==='COMPANY'){
    return NextResponse.json({error:'Forbidden'},{status:403,headers});
  }
  const query=new URL(request.url).searchParams;
  for(const key of query.keys()){
    const values=query.getAll(key);
    if(values.length!==1||!['v','preview'].includes(key)||
      (key==='preview'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values[0]))||
      (key==='v'&&(!values[0]||values[0].length>100||/[\x00-\x1f\x7f]/.test(values[0])))){
      return NextResponse.json({error:'Invalid request'},{status:400,headers});
    }
  }
  try{
    const file=await readOwnProviderProfileImage(user);
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.mimeType))return NextResponse.json({error:'Not found'},{status:404,headers});
    return new NextResponse(file.bytes,{headers:{...headers,'Content-Type':file.mimeType,'Content-Disposition':'inline'}});
  }catch(error){
    return NextResponse.json({error:'Not found'},{status:error instanceof Error&&error.message==='FORBIDDEN'?403:404,headers});
  }
}

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
 const returnTo=workspaceFormReturnPath(text(form,'returnTo'),'/app/company-page');
  try{
    if(text(form,'command')==='REMOVE'){
      await removeProviderProfileImage(user);
      return redirectWith(request,returnTo,'success','Provider image removed.');
    }
    await updateProviderProfileImage(user,form.get('profileImage'));
    return redirectWith(request,returnTo,'success','Provider image updated.');
  }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
