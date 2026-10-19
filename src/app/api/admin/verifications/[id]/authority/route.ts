import {NextRequest,NextResponse} from 'next/server.js';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {hasPlatformPermission,PLATFORM_PERMISSIONS} from '@/lib/workspace.js';
import {confirmProviderVehicleAuthority,revokeProviderVehicleAuthority} from '@/lib/provider-authority.js';
import {reviewQueueReturnPath} from '@/lib/review-navigation.js';
import {redirectWith,text} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  let returnTo='/admin/reviews?tab=documents';
  try{
    if(!hasPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST))throw new Error('FORBIDDEN');
    const {id}=await params;z.string().uuid().parse(id);
    const form=await request.formData();returnTo=reviewQueueReturnPath(text(form,'returnTo'),'documents');
    const keys=[...form.keys()];
    if(new Set(keys).size!==keys.length)throw new Error('INVALID_AUTHORITY_FACT');
    const action=text(form,'action');
    if(action==='CONFIRM'){
      if(keys.some(key=>!['action','returnTo','factKind','holderBasis','expiresOn','reviewNote','confirmed','contextRevision'].includes(key))||text(form,'confirmed')!=='1')throw new Error('INVALID_AUTHORITY_FACT');
      const factKind=z.enum(['OWNERSHIP','PERMISSION','OPERATING_LICENCE']).parse(text(form,'factKind'));
      const holderBasis=text(form,'holderBasis');
      await confirmProviderVehicleAuthority(user,id,{factKind,contextRevision:z.string().regex(/^[a-f0-9]{64}$/).parse(text(form,'contextRevision')),...(holderBasis?{holderBasis:z.enum(['OWNED','FINANCED']).parse(holderBasis)}:{}),...(text(form,'expiresOn')?{expiresOn:text(form,'expiresOn')}:{}),reviewNote:text(form,'reviewNote')});
      return redirectWith(request,returnTo,'success','Vehicle relationship confirmed.');
    }
    if(action!=='REVOKE'||keys.some(key=>!['action','returnTo','authorityReviewId','reason'].includes(key)))throw new Error('INVALID_AUTHORITY_FACT');
    await revokeProviderVehicleAuthority(user,z.string().uuid().parse(text(form,'authorityReviewId')),text(form,'reason'));
    return redirectWith(request,returnTo,'success','Vehicle relationship review revoked.');
  }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
