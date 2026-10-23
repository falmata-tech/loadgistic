import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {setProviderDrivingMode} from '@/lib/provider-driving-mode';
import {redirectWith} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  try{
    const form=await request.formData();
    const values=form.getAll('drivesTruck');
    if(values.length!==1||!['1','0'].includes(String(values[0]))||[...form.keys()].some(key=>key!=='drivesTruck'))throw new Error('INVALID_DRIVING_MODE');
    await setProviderDrivingMode(user,{drivesTruck:values[0]==='1'});
    return redirectWith(request,'/app/more','success','Driving preference saved.');
  }catch(error){return redirectWith(request,'/app/more','error',errorMessage(error));}
}
