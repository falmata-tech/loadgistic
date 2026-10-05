import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {updateDriverPortrait,removeDriverPortrait} from '@/lib/driver-portrait-storage.js';
import {redirectWith,text} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';

export const runtime='nodejs';
export async function POST(request:NextRequest){
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.json({error:'Please log in.'},{status:401});
  if(user.role!=='DRIVER')return NextResponse.json({error:'You do not have permission to change a Driver photo.'},{status:403});
  try{
    const form=await request.formData();
    const keys=[...form.keys()];
    if(new Set(keys).size!==keys.length||keys.some(key=>!['command','photo','consent'].includes(key)))throw new Error('INVALID_PORTRAIT_COMMAND');
    const action=text(form,'command');
    if(action==='REMOVE'){
      await removeDriverPortrait(user);
      return redirectWith(request,'/app/more','success','Driver photo removed.');
    }
    if(action!=='UPLOAD')throw new Error('INVALID_PORTRAIT_COMMAND');
    const file=form.get('photo');
    if(!(file instanceof File))throw new Error('PORTRAIT_REQUIRED');
    await updateDriverPortrait(user,file,text(form,'consent')==='on');
    return redirectWith(request,'/app/more','success','Public Driver photo updated.');
  }catch(error){return redirectWith(request,'/app/more','error',errorMessage(error));}
}
