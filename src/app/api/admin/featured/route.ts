import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { disableProviderSponsorship,saveFeaturedProviderDay,saveProviderSponsorship } from '@/lib/platform-admin.js';
import { redirectWith,text } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  const featureDate=text(form,'featureDate');
  const command=text(form,'command');
  try{
    if(command==='SAVE_SPONSOR'){
      await saveProviderSponsorship(user,{
        featureDate,
        sponsorshipId:text(form,'sponsorshipId'),
        sponsorKind:text(form,'sponsorKind'),
        providerKey:text(form,'providerKey'),
        businessName:text(form,'businessName'),
        description:text(form,'description'),
        websiteUrl:text(form,'websiteUrl'),
        phone:text(form,'phone'),
        startsOn:text(form,'startsOn'),
        endsOn:text(form,'endsOn'),
        position:text(form,'position')
      });
      return redirectWith(request,`/admin/featured?date=${encodeURIComponent(featureDate)}`,'success','Sponsored placement saved.');
    }
    if(command==='DISABLE_SPONSOR'){
      await disableProviderSponsorship(user,text(form,'sponsorshipId'));
      return redirectWith(request,`/admin/featured?date=${encodeURIComponent(featureDate)}`,'success','Sponsored placement disabled.');
    }
    await saveFeaturedProviderDay(user,{
      featureDate,
      publicHeadline:text(form,'publicHeadline'),
      publicIntroduction:text(form,'publicIntroduction'),
      tiktokUrl:text(form,'tiktokUrl'),
      scheduleMode:text(form,'scheduleMode'),
      scheduleConfig:{
        dayStart:text(form,'scheduleDayStart'),
        dayEnd:text(form,'scheduleDayEnd'),
        sponsorBreakEvery:text(form,'sponsorBreakEvery'),
        sponsorBreakMinutes:text(form,'sponsorBreakMinutes')
      },
      targetCount:text(form,'targetCount'),
      manualSchedule:text(form,'manualSchedule'),
      publish:command==='PUBLISH',
      truckKeys:form.getAll('truckKeys').map(value=>String(value)).filter(Boolean)
    });
    return redirectWith(request,`/admin/featured?date=${encodeURIComponent(featureDate)}`,'success',command==='PUBLISH'?'Daily feature published.':'Draft saved.');
  }catch(error){
    return redirectWith(request,`/admin/featured?date=${encodeURIComponent(featureDate)}`,'error',errorMessage(error));
  }
}
