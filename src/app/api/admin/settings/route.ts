import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {hasPlatformPermission} from '@/lib/platform-admin.js';
import {savePlatformControls,saveFeaturedControls} from '@/lib/platform-controls.js';
import {prepareFeaturedDaysForUser} from '@/lib/featured-automation.js';
import {redirectWith,text} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Forbidden'},{status:403});
  const form=await request.formData();const section=text(form,'section');
  const featuredSection=section==='FEATURED'||section==='PREPARE_FEATURED';
  if(featuredSection?!hasPlatformPermission(user,'FEATURED'):user.role!=='ADMIN')return NextResponse.json({error:'Forbidden'},{status:403});
  if(section==='ACCESS')return NextResponse.json({error:'Platform payment plans are not offered.'},{status:410});
  const destination='/admin/featured';
  try{
    if(section==='PREPARE_FEATURED'){
      const result=await prepareFeaturedDaysForUser(user);
      if(result.busy)return redirectWith(request,destination,'error','Another selection check is already running. Try again shortly.');
      return redirectWith(request,destination,'success',`${result.created} days prepared. ${result.skipped} kept unchanged.${result.empty?' Some days are waiting for eligible pairs or their next turn.':''}`);
    }
    await (section==='FEATURED'?saveFeaturedControls:savePlatformControls)(user,{section,mode:text(form,'mode'),confirm:text(form,'confirm'),target_count:text(form,'targetCount')});
    return redirectWith(request,destination,'success',section==='ACCESS'?'Workspace access updated.':'Daily selection settings saved.');
  }catch(error){return redirectWith(request,destination,'error',errorMessage(error));}
}
