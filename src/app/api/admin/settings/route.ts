import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {savePlatformControls} from '@/lib/platform-controls.js';
import {prepareAutomaticFeaturedDays} from '@/lib/featured-automation.js';
import {redirectWith,text} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user||user.role!=='ADMIN')return NextResponse.json({error:'Forbidden'},{status:403});
  const form=await request.formData();const section=text(form,'section');
  const destination=section==='ACCESS'?'/admin/settings':'/admin/featured';
  try{
    if(section==='PREPARE_FEATURED'){
      const result=await prepareAutomaticFeaturedDays();
      return redirectWith(request,destination,'success',`${result.created} days prepared. ${result.skipped} kept unchanged.${result.empty?' Some days have no eligible drivers yet.':''}`);
    }
    await savePlatformControls(user,{section,mode:text(form,'mode'),confirm:text(form,'confirm'),target_count:text(form,'targetCount')});
    return redirectWith(request,destination,'success',section==='ACCESS'?'Workspace access updated.':'Daily selection settings saved.');
  }catch(error){return redirectWith(request,destination,'error',errorMessage(error));}
}
