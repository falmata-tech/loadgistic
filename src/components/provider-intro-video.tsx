"use client";

import React from 'react';
import { Play } from 'lucide-react';

export function ProviderIntroVideo({videoId,providerName}:{videoId:string;providerName:string}){
  const [playing,setPlaying]=React.useState(false);
  if(!/^[A-Za-z0-9_-]{11}$/.test(videoId))return null;
  return <div className="provider-video">{playing?<iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} title={`${providerName} introduction`} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen/>:<button type="button" onClick={()=>setPlaying(true)} style={{backgroundImage:`linear-gradient(90deg,rgba(3,20,33,.82),rgba(3,20,33,.2)),url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)`}}><Play aria-hidden="true"/><span><strong>Meet {providerName}</strong><small>Play provider introduction</small></span></button>}</div>;
}
