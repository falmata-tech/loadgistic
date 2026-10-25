import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {revokePrivateCapacityAccess} from '@/lib/private-capacity.js';
import {retiredPlatformCapacityResponse} from '@/lib/retired-brokerage';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try{
    const action=text(form,'action');
    if(action==='GRANT'||action==='NAME')return NextResponse.json({error:'Email Capacity sharing has ended. Share with a shipper or broker account in Network.'},{status:410});
    if(action==='REVOKE')await revokePrivateCapacityAccess(user,text(form,'grantId'));
    else if(action==='LOADGISTIC')return retiredPlatformCapacityResponse();
    else throw new Error('INVALID_NETWORK_ACTION');
    return redirectWith(request,'/app/network','success','Capacity access removed.');
  }catch(error){return redirectWith(request,'/app/network','error',errorMessage(error));}
}
