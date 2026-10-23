export const FEATURED_TIKTOK_STATES=Object.freeze(['NOT_SCHEDULED','SCHEDULED','LIVE','ENDED']);

/** Keep broadcast status distinct from the vehicle showcase timetable. */
export function featuredTikTokPresentation(status,hasTikTokLink){
  if(!hasTikTokLink||!FEATURED_TIKTOK_STATES.includes(String(status)))
    return {state:'not-scheduled',message:'No TikTok LIVE broadcast planned today',action:null};
  if(status==='LIVE')return {state:'live',message:'TikTok LIVE broadcast is on now',action:'Watch live on TikTok'};
  if(status==='SCHEDULED')return {state:'scheduled',message:'TikTok LIVE broadcast planned · {time} EAT',action:'View on TikTok'};
  return {state:'ended',message:'TikTok LIVE broadcast ended today',action:'View on TikTok'};
}
