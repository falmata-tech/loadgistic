'use client';

import React from 'react';
import Link from 'next/link';
import {Building2,ChevronLeft,ChevronRight,Pause,Play,ExternalLink,Phone} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {PublicIdentityImage} from './public-identity-image';
import styles from './featured-sponsors.module.css';

type Sponsor={sponsor_kind:string;name:string;handle?:string;description?:string;profile_image_url?:string;website_url?:string;phone?:string};
export function FeaturedSponsors({providers}:{providers:Sponsor[]}){
  const {t}=useTranslation();
  const [index,setIndex]=React.useState(0),[paused,setPaused]=React.useState(false);
  const [reduced,setReduced]=React.useState(false);
  const rail=React.useRef(null as HTMLElement|null);
  const count=providers.length;
  React.useEffect(()=>{
    const pref=window.matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>setReduced(pref.matches);
    change();pref.addEventListener('change',change);
    return ()=>pref.removeEventListener('change',change);
  },[]);
  React.useEffect(()=>{
    if(count<2||paused||reduced)return;
    const timer=window.setInterval(()=>{
      if(!document.hidden&&!rail.current?.contains(document.activeElement)&&!rail.current?.matches(':hover'))setIndex((i:number)=>(i+1)%count);
    },8000);
    return ()=>window.clearInterval(timer);
  },[count,paused,reduced]);
  if(!count)return null;
  const current=index%count,sponsor=providers[current],advertiser=sponsor.sponsor_kind==='ADVERTISER';
  const step=(direction:number)=>{setIndex((current+count+direction)%count);setPaused(true);};
  return <aside className={styles.panel+' expo-sponsored-rail'} ref={rail} aria-label={t('Sponsors')}>
    <div className={styles.top}><h3><Text message="Sponsors"/></h3>{count>1&&<div className={styles.controls}>
      <button type="button" onClick={()=>step(-1)} aria-label={t('Previous sponsor')}><ChevronLeft/></button>
      <span>{current+1} / {count}</span>
      {!reduced&&<button type="button" onClick={()=>setPaused(!paused)} aria-label={t(paused?'Resume rotation':'Pause rotation')}>{paused?<Play/>:<Pause/>}</button>}
      <button type="button" onClick={()=>step(1)} aria-label={t('Next sponsor')}><ChevronRight/></button>
    </div>}</div>
    <section className={styles.card+' expo-sponsored-card'} aria-live="off">
      {advertiser?(sponsor.profile_image_url?<img className={styles.art} src={sponsor.profile_image_url} alt=""/>:<Building2 className={styles.placeholder} aria-hidden="true"/>):<PublicIdentityImage path={sponsor.profile_image_url} kind="company" label={sponsor.name}/>}
      <div className={styles.copy}><strong>{sponsor.name}</strong>{sponsor.description&&<p>{sponsor.description}</p>}
        <div className={styles.links}>{advertiser?<>{sponsor.phone&&<a href={`tel:${sponsor.phone}`}><Phone/><Text message="Call"/></a>}{sponsor.website_url&&<a href={sponsor.website_url} target="_blank" rel="noopener noreferrer"><ExternalLink/><Text message="Visit page"/></a>}</>:<><a href={`/@${encodeURIComponent(sponsor.handle||'')}`}><Text message="Profile"/></a><Link href={`/?provider=${encodeURIComponent(sponsor.handle||'')}`}><Text message="Vehicles"/></Link></>}</div>
      </div>
    </section>
    <p className={styles.note}><Text message="Confirm sponsor claims and terms directly."/></p>
  </aside>;
}
