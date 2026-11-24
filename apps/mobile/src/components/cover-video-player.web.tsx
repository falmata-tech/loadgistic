import {useEffect,useRef} from 'react';
import {coverEmbedUrl,coverPlayerPermissions,observeCoverPlayer} from '../../../../src/lib/provider-cover-video.js';

export function CoverVideoPlayer({videoId,title,loading,onResult}:{
  videoId:string;title:string;loading:boolean;onResult:(result:'ready'|'failed')=>void;
}){
  const frame=useRef<HTMLIFrameElement>(null);
  const src=coverEmbedUrl(videoId,window.location.origin);
  useEffect(()=>{
    if(frame.current)return observeCoverPlayer(frame.current,onResult);
  },[src,onResult]);
  if(!src)return null;
  return <iframe
    ref={frame}
    src={src}
    title={title}
    aria-hidden={loading}
    tabIndex={loading?-1:0}
    style={{display:'block',width:'100%',height:'100%',border:0}}
    referrerPolicy="strict-origin-when-cross-origin"
    allow={coverPlayerPermissions}
    allowFullScreen
  />;
}
