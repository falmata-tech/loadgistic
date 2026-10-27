export const FEATURED_TIKTOK_STATES=Object.freeze(['NOT_SCHEDULED','SCHEDULED','LIVE','ENDED']);

function safeTikTokUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&(url.hostname==='tiktok.com'||url.hostname.endsWith('.tiktok.com'))?url.toString():null;
  }catch{return null;}
}

/** Admin state stays exact; public broadcast presentation requires a confirmed state, link and time. */
export function featuredTikTokPresentation(status,tiktokUrl,startTime){
  const href=safeTikTokUrl(tiktokUrl),validTime=typeof startTime==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime);
  const showPublic=Boolean(href&&validTime&&(status==='LIVE'||status==='SCHEDULED'));
  if(status==='LIVE')return {state:'live',message:'TikTok LIVE broadcast is on now',action:showPublic?'Watch live on TikTok':null,href:showPublic?href:null,showPublic};
  if(status==='SCHEDULED')return {state:'scheduled',message:'TikTok LIVE broadcast planned · {time} EAT',action:showPublic?'View on TikTok':null,href:showPublic?href:null,showPublic};
  if(status==='ENDED')return {state:'ended',message:'Ended',action:null,href:null,showPublic:false};
  return {state:'not-scheduled',message:'Not scheduled',action:null,href:null,showPublic:false};
}
