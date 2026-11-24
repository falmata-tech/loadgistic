'use client';

import React from 'react';
import {coverEmbedUrl,coverPlayerPermissions,coverPosterPath,observeCoverPlayer} from '@/lib/provider-cover-video.js';
import {Play} from 'lucide-react';
import {Text,useTranslation} from './localization';

type CoverStage='initializing'|'poster'|'loading'|'ready'|'failed';

export function ProviderIntroVideo({videoId}:{videoId:string}){
  const {t}=useTranslation();
  const [stage,setStage]=React.useState('initializing' as CoverStage);
  const frame=React.useRef(null as HTMLIFrameElement|null);
  const active=stage==='loading'||stage==='ready';
  React.useEffect(()=>{setStage('poster');},[]);
  React.useEffect(()=>{
    if(active&&frame.current)return observeCoverPlayer(frame.current,setStage);
  },[active,videoId]);
  React.useEffect(()=>{
    if(stage==='ready'&&document.activeElement===document.body)frame.current?.focus({preventScroll:true});
  },[stage]);
  const poster=coverPosterPath(videoId);
  if(!poster)return null;
  const image=<img src={poster} alt="" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>;
  const start=()=>setStage('loading');
  return <div className="profile-cover">
    {active&&<iframe ref={frame} className="profile-cover-player" src={coverEmbedUrl(videoId,window.location.origin)||undefined}
        title={t('Cover video')} tabIndex={stage==='loading'?-1:0} aria-hidden={stage==='loading'}
        referrerPolicy="strict-origin-when-cross-origin"
        allow={coverPlayerPermissions} allowFullScreen/>}
    {(stage==='initializing'||stage==='poster')&&
      <button type="button" className="profile-cover-poster" disabled={stage==='initializing'}
        onClick={start} aria-label={t('Play cover video')}>
        {image}<span className="profile-cover-play"><Play aria-hidden="true"/></span>
      </button>}
    {(stage==='loading'||stage==='failed')&&
      <div className="profile-cover-feedback">
        {image}
        {stage==='loading'
          ? <div className="profile-cover-status" role="status"><span className="profile-cover-spinner" aria-hidden="true"/><Text message="Loading video…"/></div>
          : <div className="profile-cover-status profile-cover-error">
              <span role="status"><Text message="Video couldn’t load."/></span>
              <div>
                <button className="button small secondary" type="button" onClick={start}><Text message="Try again"/></button>
                <a className="button small secondary" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"><Text message="Watch on YouTube"/></a>
              </div>
            </div>}
      </div>}
  </div>;
}
