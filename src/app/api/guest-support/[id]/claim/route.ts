import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {claimGuestSupportConversation} from '@/lib/repository.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith} from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;try{claimGuestSupportConversation(user,id);return redirectWith(request,`/support/assisted/${id}`,'success','Conversation assigned.');}catch(error){return redirectWith(request,'/support/assisted?view=WAITING','error',errorMessage(error));}
}
