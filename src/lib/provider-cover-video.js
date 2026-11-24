export const exampleCover={
  id:'yEJMXHO8rt4',
  poster:'https://i.ytimg.com/vi/yEJMXHO8rt4/maxresdefault.jpg'
};
const coverPosters=new Map([
  [exampleCover.id,exampleCover.poster],
  ['g8IIcDAPqIQ','/marketing/covers/ethiopian-truck-driver.jpg'],
  ['WZMVTHGhlbg','/marketing/covers/ethiopian-sinotruk.jpg']
]);
const youtubeIdPattern=/^[A-Za-z0-9_-]{11}$/;
export const coverPlayerOrigin='https://www.youtube-nocookie.com';
export const coverPlayerTimeoutMs=15_000;
export const coverPlayerPermissions="autoplay; encrypted-media; fullscreen; picture-in-picture; camera 'none'; microphone 'none'; geolocation 'none'";
const playerChannel={id:'loadgistic-cover',channel:'widget'};
export const coverPlayerSubscription=[
  {event:'listening',...playerChannel},
  ...['onStateChange','onAutoplayBlocked','onError'].map(name=>({
    event:'command',func:'addEventListener',args:[name],...playerChannel
  }))
].map(message=>JSON.stringify(message));

// Store only an ID. The public clients construct playback and poster URLs locally.
export function youtubeCoverId(input) {
  const text=String(input??'').trim();
  if (!text) return null;
  let url;
  try { url=new URL(text); } catch { throw Error('INVALID_COVER_VIDEO'); }
  let id=null;
  if (url.protocol==='https:' && !url.username && !url.password && !url.port) {
    if (url.hostname==='youtu.be') id=url.pathname.slice(1);
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)) {
      id=url.pathname==='/watch' ? url.searchParams.get('v') : /^\/(?:shorts|embed|live)\/([^/]+)$/.exec(url.pathname)?.[1];
    }
  }
  if (!id || !youtubeIdPattern.test(id)) throw Error('INVALID_COVER_VIDEO');
  return id;
}

export function coverPosterPath(id) {
  if (!youtubeIdPattern.test(id)) return null;
  return coverPosters.get(id) ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function coverEmbedUrl(id,origin='') {
  if (!youtubeIdPattern.test(id)) return null;
  const params=new URLSearchParams({autoplay:'1',playsinline:'1',enablejsapi:'1'});
  if(origin)params.set('origin',origin);
  return `${coverPlayerOrigin}/embed/${id}?${params}`;
}

export function coverPlayerResult(data){
  if(typeof data!=='string'||data.length>65_536)return null;
  let message;
  try{message=JSON.parse(data);}catch{return null;}
  if(message?.event==='onError')return 'failed';
  if(message?.event==='onAutoplayBlocked')return 'ready';
  const state=message?.event==='onStateChange'?message.info
    :['initialDelivery','infoDelivery'].includes(message?.event)?message.info?.playerState:null;
  return [0,1,2,5].includes(state)?'ready':null;
}

export function observeCoverPlayer(frame,onResult){
  const player=frame.contentWindow;
  if(!player)return;
  const parent=frame.ownerDocument.defaultView;
  const subscribe=()=>{
    for(const message of coverPlayerSubscription)player.postMessage(message,coverPlayerOrigin);
  };
  let status=null;
  const report=result=>{
    if(result===status||status==='failed')return;
    status=result;
    parent.clearInterval(timer);
    parent.clearTimeout(timeout);
    onResult(result);
  };
  const timer=parent.setInterval(subscribe,400);
  const timeout=parent.setTimeout(()=>report('failed'),coverPlayerTimeoutMs);
  function receive(message){
    if(message.origin!==coverPlayerOrigin||message.source!==player)return;
    const result=coverPlayerResult(message.data);
    if(result)report(result);
  }
  parent.addEventListener('message',receive);
  subscribe();
  return ()=>{
    parent.clearInterval(timer);
    parent.clearTimeout(timeout);
    parent.removeEventListener('message',receive);
  };
}
