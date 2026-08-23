"use client";

import React from 'react';
import Link from 'next/link';
import {BadgeDollarSign,Building2,CalendarDays,ChevronDown,Clock3,ExternalLink,Gauge,Globe2,MapPin,Phone,Play,Route,ShieldCheck,Star,Truck,X} from 'lucide-react';
import {buildFeaturedDaySchedule} from '@/lib/expo-broadcast.js';

function ProviderIdentity({provider}:{provider:any}){
  return <img src={provider.profile_image_url||'/marketing/default-transporter-profile.png'} alt={provider.profile_image_url?`${provider.name} transporter profile`:`Default transporter portrait for ${provider.name}`}/>;
}

function ProviderPreview({provider,walkthrough,onClose}:{provider:any;walkthrough:any;onClose:()=>void}){
  const dialogRef=React.useRef(null as HTMLDialogElement|null);
  React.useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;dialog.showModal();return()=>{if(dialog.open)dialog.close();};},[]);
  const corridorText=provider.corridors?.length?provider.corridors.join(' · '):provider.operating_regions||`${provider.base_region} service area`;
  return <dialog ref={dialogRef} className="expo-provider-dialog" aria-labelledby="expo-provider-dialog-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialogRef.current)onClose();}}><article><button type="button" onClick={onClose} aria-label="Close transporter details"><X aria-hidden="true"/></button><div className="expo-dialog-identity"><ProviderIdentity provider={provider}/><span><small>{provider.provider_kind_label}</small><h3 id="expo-provider-dialog-title">{provider.name}</h3><p><MapPin aria-hidden="true"/>{provider.base_place} · {provider.base_region}</p></span></div><p>{provider.about||provider.headline||'Independent road-freight transporter.'}</p><div className="expo-dialog-service"><span><Building2 aria-hidden="true"/><span><small>Services</small><strong>{provider.services||'Road-freight transport'}</strong></span></span><span><Route aria-hidden="true"/><span><small>Coverage</small><strong>{corridorText}</strong></span></span><span><Clock3 aria-hidden="true"/><span><small>Presentation time</small><strong>{walkthrough?.label||'Featured schedule'}</strong></span></span></div><div className="expo-dialog-facts"><span><Truck aria-hidden="true"/><strong>{provider.fleet_size}</strong><small>active {provider.fleet_size===1?'truck':'trucks'}</small></span><span><Gauge aria-hidden="true"/><strong>{provider.active_capacity_count}</strong><small>available now</small></span><span><Star aria-hidden="true"/><strong>{provider.review_count?provider.average_rating:'New'}</strong><small>{provider.review_count?`${provider.review_count} verified reviews`:'to Loadgistic'}</small></span></div><div className="verification-reminder"><ShieldCheck aria-hidden="true"/><span>Confirm current documents, capacity, cargo fit, price, timing, and responsibility with the transporter.</span></div><div className="expo-dialog-actions"><Link className="button" href={`/@${encodeURIComponent(provider.handle)}`}><Building2 aria-hidden="true"/>View transporter profile</Link><Link className="button secondary" href={`/?q=${encodeURIComponent(provider.name)}&provider=${encodeURIComponent(provider.handle)}`}><Truck aria-hidden="true"/>View trucks on map</Link></div></article></dialog>;
}

function SponsoredProviders({providers}:{providers:any[]}){
  const [mobile,setMobile]=React.useState(false);
  const [start,setStart]=React.useState(0);
  const focusWithin=React.useRef(false);
  React.useEffect(()=>{
    const query=window.matchMedia('(max-width: 620px)');
    const update=()=>{setMobile(query.matches);setStart(0);};
    update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
  },[]);
  React.useEffect(()=>{
    if(!mobile||providers.length<=2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=window.setInterval(()=>{if(!focusWithin.current)setStart((current:number)=>(current+2)%providers.length);},8000);
    return()=>window.clearInterval(timer);
  },[mobile,providers.length]);
  const visible=mobile&&providers.length>2?[providers[start%providers.length],providers[(start+1)%providers.length]]:providers;
  if(!providers.length)return null;
  return <aside className="expo-sponsored-rail" aria-labelledby="sponsored-provider-title" onFocusCapture={()=>{focusWithin.current=true;}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))focusWithin.current=false;}}><header><span><BadgeDollarSign aria-hidden="true"/>Sponsored</span><h3 id="sponsored-provider-title">Sponsors</h3><p>{providers.length} active</p></header><div aria-live="off">{visible.map(provider=>provider.sponsor_kind==='ADVERTISER'?<article key={`advertiser-${provider.sponsor_position}-${provider.name}`} className="expo-sponsored-card advertiser"><span className="expo-sponsor-mark" aria-hidden="true"><Building2/></span><span><small>Outside advertiser</small><strong>{provider.name}</strong><p>{provider.description}</p><span className="expo-sponsored-actions">{provider.website_url?<a href={provider.website_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/>Website</a>:null}{provider.phone?<a href={`tel:${provider.phone}`}><Phone aria-hidden="true"/>{provider.phone}</a>:null}</span></span></article>:<article key={`transporter-${provider.sponsor_position}-${provider.handle}`} className="expo-sponsored-card"><ProviderIdentity provider={provider}/><span><small>{provider.base_place} · Transporter</small><strong>{provider.name}</strong><span className="expo-sponsored-actions"><Link href={`/@${encodeURIComponent(provider.handle)}`}><Building2 aria-hidden="true"/>Profile</Link><Link href={`/?q=${encodeURIComponent(provider.name)}&provider=${encodeURIComponent(provider.handle)}`}><Truck aria-hidden="true"/>Trucks on map</Link></span></span></article>)}</div><p><ShieldCheck aria-hidden="true"/>Sponsored placement. Confirm claims, credentials, and terms directly.</p></aside>;
}

function assignSponsorNames(schedule:any,providers:any[]){
  const names=providers.map(provider=>provider.name).filter(Boolean);let index=0;
  if(!names.length)return schedule;
  return {...schedule,entries:schedule.entries.map((entry:any)=>entry.type==='SPONSOR_BREAK'?{...entry,label:`Sponsor · ${names[index++%names.length]}`}:entry)};
}

function scheduleTime(iso:string){return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Addis_Ababa',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}
function featuredDateLabel(value:string){return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00Z`));}

export function TransportExpoVenue({providers,sponsoredProviders=[],featureDate,initialSchedule,week=[],expoGroup,tiktokUrl}:{providers:any[];sponsoredProviders?:any[];featureDate:string;initialSchedule:any;week?:any[];expoGroup:any;tiktokUrl?:string|null}){
  const [selectedIndex,setSelectedIndex]=React.useState(null as number|null);
  const selectedTriggerRef=React.useRef(null as HTMLButtonElement|null);
  const [now,setNow]=React.useState(()=>Date.now());
  const providerHandles=React.useMemo(()=>providers.map(provider=>provider.handle),[providers]);
  const manualSchedule=React.useMemo(()=>initialSchedule?.mode==='MANUAL'?(initialSchedule.walkthroughs||[]).map((item:any)=>({providerKey:item.provider_key,startTime:scheduleTime(item.starts_at),endTime:scheduleTime(item.ends_at)})):[],[initialSchedule]);
  const schedule=React.useMemo(()=>assignSponsorNames(buildFeaturedDaySchedule(featureDate,providerHandles,{mode:initialSchedule?.mode||'AUTO',config:initialSchedule?.config||{},manualSchedule},now),sponsoredProviders),[featureDate,providerHandles,initialSchedule?.mode,initialSchedule?.config,manualSchedule,now,sponsoredProviders]);
  const walkthroughs=schedule.walkthroughs as any[];
  const currentIndex=walkthroughs.findIndex((item:any)=>item.current);

  React.useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[]);

  function closePreview(){
    setSelectedIndex(null);
    window.requestAnimationFrame(()=>selectedTriggerRef.current?.focus());
  }

  const currentProvider=currentIndex>=0?providers[currentIndex]:null;
  const active=schedule.active_entry;
  const inactiveMessage=schedule.phase==='scheduled'?'Today’s programme is scheduled':schedule.phase==='ended'?'Today’s programme has ended':schedule.phase==='between'?'Next session begins later today':'Daily Featured Transporters';
  const scheduleLabel=currentProvider?'Live':active?(active.type==='SPONSOR_BREAK'?'Sponsor break':active.type==='INTERMISSION'?'Intermission':'Changeover'):schedule.phase==='ended'?'Ended':schedule.phase==='between'?'Later':'Schedule';
  featureDate=featuredDateLabel(featureDate);
  return <div className={`transport-expo-experience${sponsoredProviders.length?'':' without-sponsors'}`}>
    <div className="featured-programme-command"><span className="featured-programme-current"><CalendarDays aria-hidden="true"/><span><small>{expoGroup.day} · {featureDate}</small><strong>{expoGroup.shortTitle} · {providers.length} featured</strong></span></span><details className="regional-expo-week-panel" name="featured-programme-panel"><summary aria-label="View the seven-day featured transporter programme"><CalendarDays aria-hidden="true"/><span>Week</span><ChevronDown aria-hidden="true"/></summary><div className="regional-expo-week" role="region" tabIndex={0} aria-label="Weekly Daily Featured Transporters programme; scroll horizontally for every day">{week.map((group:any)=><span className={group.key===expoGroup.key?'current':''} key={group.key}><small>{group.day.slice(0,3)} · {group.dateLabel}</small><strong>{group.shortTitle}</strong>{group.key===expoGroup.key?<em>Today</em>:null}</span>)}</div></details><details className="expo-schedule-panel" name="featured-programme-panel"><summary className={`expo-live-strip ${schedule.phase}`} aria-label={`${scheduleLabel}. ${schedule.display_label} EAT. View detailed schedule`}><Clock3 aria-hidden="true"/><span>{scheduleLabel}</span><ChevronDown aria-hidden="true"/></summary><div className="expo-programme-detail"><strong>{currentProvider?`Live now · No. ${String(currentIndex+1).padStart(2,'0')} · ${currentProvider.name}`:inactiveMessage}</strong><small>{schedule.display_label} EAT</small><div className="expo-programme-strip" role="region" tabIndex={0} aria-label="Daily Featured Transporters schedule; scroll horizontally for the complete programme">{schedule.entries.map((entry:any,index:number)=><span key={`${entry.type}-${entry.starts_at}-${index}`} className={`${entry.type.toLowerCase().replace('_','-')}${active?.starts_at===entry.starts_at&&active?.type===entry.type?' active':''}`}><small>{entry.time_label}</small><strong>{entry.type==='PROVIDER'?providers.find(provider=>provider.handle===entry.provider_key)?.name:entry.label}</strong></span>)}</div></div></details>{tiktokUrl?<a className="featured-programme-action live" href={tiktokUrl} target="_blank" rel="noreferrer"><Play aria-hidden="true"/><span>Live</span><ExternalLink aria-hidden="true"/></a>:null}<Link className="featured-programme-action" href="/" aria-label="View available trucks in the Truck Market"><Truck aria-hidden="true"/><span>Trucks</span></Link></div>
    <div className="transport-expo-venue"><div className="featured-board-stage" aria-label="Daily Featured Transporters board"><div className="featured-board-surface"><div className="featured-board-grid">{providers.map((provider,index)=>{const walkthrough=walkthroughs[index];const isCurrent=walkthrough?.current;return <button key={provider.handle} type="button" className={`featured-provider-tile${isCurrent?' walkthrough-current':''}${selectedIndex===index?' selected':''}`} onClick={event=>{selectedTriggerRef.current=event.currentTarget;setSelectedIndex(index);}} aria-label={`Featured transporter ${index+1}, ${provider.name}, ${provider.provider_kind_label}, ${provider.base_place}, ${walkthrough?.label}`}><span className="featured-card-number">{String(index+1).padStart(2,'0')}</span><span className="featured-card-feature"><Globe2 aria-hidden="true"/>{isCurrent?'Live now':'Featured'}</span><span className="featured-card-photo"><ProviderIdentity provider={provider}/></span><span className="featured-card-details"><strong>{provider.name}</strong><small>{provider.provider_kind_label}</small><small><MapPin aria-hidden="true"/>{provider.base_place}</small><em>{isCurrent?'Live now':walkthrough?.label}</em></span></button>;})}</div></div></div></div>
    <SponsoredProviders providers={sponsoredProviders}/>
    {selectedIndex!==null?<ProviderPreview provider={providers[selectedIndex]} walkthrough={walkthroughs[selectedIndex]} onClose={closePreview}/>:null}
  </div>;
}
