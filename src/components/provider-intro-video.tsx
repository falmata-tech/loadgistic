'use client';

import React from 'react';
import {coverPosterPath} from '@/lib/provider-cover-video.js';
import {Play,X} from 'lucide-react';
import {Text,useTranslation} from './localization';

export function ProviderIntroVideo({videoId,providerName}:{videoId:string;providerName:string}){
  const {t}=useTranslation();
  const [playing,setPlaying]=React.useState(false);
  const dialog=React.useRef(null as HTMLDialogElement|null);
  React.useEffect(()=>{if(playing)dialog.current?.showModal();},[playing]);
  const poster=coverPosterPath(videoId);
  if(!poster)return null;
  return <div className="profile-cover">
    <button type="button" className="profile-cover-poster" onClick={()=>setPlaying(true)} aria-label={t('Play cover video')}>
      <img src={poster} alt="" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>
      <span><Play aria-hidden="true"/><Text message="Cover video"/></span>{videoId==='WZMVTHGhlbg'&&<small>Yodi Yodi · YouTube</small>}
    </button>
    {playing&&<dialog ref={dialog} className="profile-cover-player" aria-label={t('Cover video')} onClose={()=>setPlaying(false)}>
      <header><strong>{providerName}</strong><button type="button" onClick={()=>dialog.current?.close()} aria-label={t('Close')}><X/></button></header>
      <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} title={t('Cover video')} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>
      <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"><Text message="Watch on YouTube"/></a>
    </dialog>}
  </div>;
}
