import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {grantPrivateCapacityAccess,revokePrivateCapacityAccess,setLoadgisticCapacityAccess} from '@/lib/repository.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
import {deliverPendingAccessEmails} from '@/lib/email-delivery';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try{
    const action=text(form,'action');
    if(action==='GRANT'){
      await grantPrivateCapacityAccess(user,{vehicleId:text(form,'vehicleId'),email:text(form,'email')});
      await deliverPendingAccessEmails();
    }
    else if(action==='REVOKE')await revokePrivateCapacityAccess(user,text(form,'grantId'));
    else if(action==='LOADGISTIC')await setLoadgisticCapacityAccess(user,text(form,'vehicleId'),text(form,'enabled')==='on');
    else throw new Error('INVALID_NETWORK_ACTION');
    return redirectWith(request,'/app/network','success',action==='GRANT'?'Capacity access added.':action==='REVOKE'?'Capacity access removed.':'Loadgistic sharing updated.');
  }catch(error){return redirectWith(request,'/app/network','error',errorMessage(error));}
}
