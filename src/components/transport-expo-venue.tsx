"use client";


import {Localized,Text,useTranslation} from '@/components/localization';
import React from 'react';
import Link from 'next/link';
import {BadgeDollarSign,Building2,CalendarDays,ChevronDown,Clock3,ExternalLink,MapPin,Phone,Play,Radio,ShieldCheck,Truck,X} from 'lucide-react';
import {buildFeaturedDaySchedule} from '@/lib/expo-broadcast.js';
import {featuredTikTokPresentation} from '@/lib/featured-tiktok-presentation.js';
import presentation from './public-truck-presentation.module.css';
import {PublicIdentityImage} from './public-identity-image';

function ProviderIdentity({provider,size='normal'}:{provider:any;size?:'normal'|'large'}){
  return <PublicIdentityImage path={provider.profile_image_url} kind={provider.provider_kind==='FLEET_TRANSPORTER'?"company":"person"} label={provider.name||''} size={size}/>;
}
function AccountPreview({provider,walkthrough,onClose}:{provider:any;walkthrough:any;onClose:()=>void}){
  const dialogRef=React.useRef(null as HTMLDialogElement|null);
  React.useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;dialog.showModal();return()=>{if(dialog.open)dialog.close();};},[]);
  return <dialog ref={dialogRef} className="expo-provider-dialog featured-truck-dialog" aria-labelledby="featured-truck-dialog-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialogRef.current)onClose();}}>
    <article>
      <Localized as="button" copy={["aria-label"]} type="button" onClick={onClose} aria-label="Close featured account details"><X aria-hidden="true"/></Localized>
      <div className="featured-truck-dialog-visual"><ProviderIdentity provider={provider} size="large"/></div>
      <div className="featured-truck-dialog-copy"><small><Text message="Transport Provider"/></small><h3 id="featured-truck-dialog-title">{provider.name}</h3><p>@{provider.handle}</p><p><Truck aria-hidden="true"/>{provider.fleet_size} <Text message={provider.fleet_size===1?'vehicle':'vehicles'}/></p>{provider.base_place?<p><MapPin aria-hidden="true"/>{provider.base_place}</p>:null}</div>
      <div className="featured-truck-dialog-time"><Clock3 aria-hidden="true"/><span><small><Text message="Programme time"/></small><strong>{walkthrough?.label||'08:30–12:00 EAT'}</strong></span></div>
      <div className="expo-dialog-actions"><Link className="button" href={`/@${encodeURIComponent(provider.handle)}`}><Building2 aria-hidden="true"/><Text message="Transporter profile"/></Link>{provider.public_capacity_available&&provider.map_href?<Link className="button secondary" href={provider.map_href}><Truck aria-hidden="true"/><Text message="View available vehicles"/></Link>:null}</div>
    </article>
  </dialog>;
}

function SponsoredProviders({providers}:{providers:any[]}){
  const [mobile,setMobile]=React.useState(false);const [start,setStart]=React.useState(0);const focusWithin=React.useRef(false);
  React.useEffect(()=>{const query=window.matchMedia('(max-width: 620px)');const update=()=>{setMobile(query.matches);setStart(0);};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  React.useEffect(()=>{if(!mobile||providers.length<=2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=window.setInterval(()=>{if(!focusWithin.current)setStart((current:number)=>(current+2)%providers.length);},8000);return()=>window.clearInterval(timer);},[mobile,providers.length]);
  const visible=mobile&&providers.length>2?[providers[start%providers.length],providers[(start+1)%providers.length]]:providers;
  if(!providers.length)return null;
  return <aside className="expo-sponsored-rail" aria-labelledby="sponsored-provider-title" onFocusCapture={()=>{focusWithin.current=true;}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))focusWithin.current=false;}}>
    <header><span><BadgeDollarSign aria-hidden="true"/><Text message="Sponsored"/></span><h3 id="sponsored-provider-title"><Text message="Sponsors"/></h3></header>
    <div aria-live="off">{visible.map(provider=>provider.sponsor_kind==='ADVERTISER'
      ?<article key={`advertiser-${provider.sponsor_position}-${provider.name}`} className="expo-sponsored-card advertiser"><span className="expo-sponsor-mark" aria-hidden="true"><Building2/></span><span><small><Text message="Advertiser"/></small><strong>{provider.name}</strong><p>{provider.description}</p><span className="expo-sponsored-actions">{provider.website_url?<a href={provider.website_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/><Text message="Website"/></a>:null}{provider.phone?<a href={`tel:${provider.phone}`}><Phone aria-hidden="true"/><Text message="Call"/></a>:null}</span></span></article>
      :<article key={`transporter-${provider.sponsor_position}-${provider.handle}`} className="expo-sponsored-card"><ProviderIdentity provider={provider}/><span><small><Text message="Transporter"/></small><strong>{provider.name}</strong><span className="expo-sponsored-actions"><Link href={`/@${encodeURIComponent(provider.handle)}`}><Building2 aria-hidden="true"/><Text message="Profile"/></Link><Link href={`/?provider=${encodeURIComponent(provider.handle)}`}><Truck aria-hidden="true"/><Text message="Vehicles"/></Link></span></span></article>)}</div>
    <p><ShieldCheck aria-hidden="true"/><Text message="Confirm sponsor claims and terms directly."/></p>
  </aside>;
}

function assignSponsorNames(schedule:any,providers:any[]){
  const names=providers.map(provider=>provider.name).filter(Boolean);let index=0;if(!names.length)return schedule;
  return {...schedule,entries:schedule.entries.map((entry:any)=>entry.type==='PROGRAMME_BREAK'?{...entry,label:`Sponsor · ${names[index++%names.length]}`}:entry)};
}

function scheduleTime(iso:string){return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Addis_Ababa',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}
function featuredDateLabel(value:string){return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00Z`));}

export function TransportExpoVenue({providers,sponsoredProviders=[],featureDate,initialSchedule,week=[],expoGroup,tiktokUrl,tiktokStatus='NOT_SCHEDULED',tiktokStart='08:30'}:{providers:any[];sponsoredProviders?:any[];featureDate:string;initialSchedule:any;week?:any[];expoGroup:any;tiktokUrl?:string|null;tiktokStatus?:string;tiktokStart?:string}){
  const [selectedIndex,setSelectedIndex]=React.useState(null as number|null);const selectedTriggerRef=React.useRef(null as HTMLButtonElement|null);const [now,setNow]=React.useState(()=>Date.now());
  const accountKeys=React.useMemo(()=>providers.map(provider=>provider.provider_key),[providers]);
  const manualSchedule=React.useMemo(()=>initialSchedule?.mode==='MANUAL'?(initialSchedule.walkthroughs||[]).map((item:any)=>({providerKey:item.provider_key,startTime:scheduleTime(item.starts_at),endTime:scheduleTime(item.ends_at)})):[],[initialSchedule]);
  const schedule=React.useMemo(()=>assignSponsorNames(buildFeaturedDaySchedule(featureDate,accountKeys,{mode:initialSchedule?.mode||'AUTO',config:initialSchedule?.config||{},manualSchedule,allowLegacyWindow:true},now),sponsoredProviders),[featureDate,accountKeys,initialSchedule?.mode,initialSchedule?.config,manualSchedule,now,sponsoredProviders]);
  const walkthroughs=schedule.walkthroughs as any[];const currentIndex=walkthroughs.findIndex((item:any)=>item.current);const active=schedule.active_entry;
  React.useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[]);
  function closePreview(){setSelectedIndex(null);window.requestAnimationFrame(()=>selectedTriggerRef.current?.focus());}
  const {t}=useTranslation();
  const stateLabel=schedule.phase==='live'?'Featured now':schedule.phase==='break'?'Interlude':schedule.phase==='ended'?'Showcase finished':'Scheduled';
  const tiktok=featuredTikTokPresentation(tiktokStatus,Boolean(tiktokUrl));
  return <div className={`transport-expo-experience featured-truck-experience${sponsoredProviders.length?'':' without-sponsors'}`}>
    <div className="featured-programme-command">
      <span className="featured-programme-current"><CalendarDays aria-hidden="true"/><span><small>{featuredDateLabel(featureDate)}</small><strong>{providers.length} <Text message={providers.length===1?'Transport Provider':'Transport Providers'}/></strong></span></span>
      <details className="expo-schedule-panel" name="featured-programme-panel"><summary className={`expo-live-strip ${schedule.phase}`} aria-label={`${t(stateLabel)}. ${schedule.display_label} EAT. ${t('View schedule')}`}><Clock3 aria-hidden="true"/><span>{t(stateLabel)}</span><ChevronDown aria-hidden="true"/></summary><div className="expo-programme-detail"><strong>{currentIndex>=0?<><Text message="Featured now"/> · {providers[currentIndex]?.name}</>:<Text message={stateLabel}/>}</strong><small>{schedule.display_label} EAT</small><Localized as="div" copy={["aria-label"]} className="expo-programme-strip" role="region" tabIndex={0} aria-label="Featured account programme">{schedule.entries.map((entry:any,index:number)=><span key={`${entry.type}-${entry.starts_at}-${index}`} className={`${entry.type.toLowerCase().replace('_','-')}${active?.starts_at===entry.starts_at&&active?.type===entry.type?' active':''}`}><small>{entry.time_label}</small><strong>{entry.type==='PROVIDER'?providers.find(provider=>provider.provider_key===entry.provider_key)?.name:entry.label}</strong></span>)}</Localized></div></details>
      <div className={`featured-tiktok-status ${tiktok.state}`} role="status"><Radio aria-hidden="true"/><strong><Text message={tiktok.message} values={{time:tiktokStart}}/></strong>{tiktokUrl&&tiktok.action?<a className="featured-tiktok-link" href={tiktokUrl} target="_blank" rel="noreferrer"><Play aria-hidden="true"/><span><Text message={tiktok.action}/></span><ExternalLink aria-hidden="true"/></a>:null}</div>
      <Localized as="link" copy={["aria-label"]} className="featured-programme-action" href="/" aria-label="Find open transport capacity"><Truck aria-hidden="true"/><span><Text message="Capacity"/></span></Localized>
    </div>
    <div className="transport-expo-venue"><div className="featured-board-stage" aria-label={t('Featured Transport Providers')}><div className="featured-board-surface"><div className="featured-board-grid">{providers.map((provider,index)=>{const walkthrough=walkthroughs.find((item:any)=>item.provider_key===provider.provider_key);const isCurrent=Boolean(walkthrough?.current);return <button key={provider.provider_key} type="button" className={`featured-provider-tile featured-truck-tile ${presentation.tile}${isCurrent?' walkthrough-current':''}${selectedIndex===index?' selected':''}`} onClick={event=>{selectedTriggerRef.current=event.currentTarget;setSelectedIndex(index);}} aria-label={t('Featured account {name}, {count} vehicles',{name:provider.name,count:provider.fleet_size})}><span className="featured-card-number">{String(index+1).padStart(2,'0')}</span>{isCurrent?<span className="featured-card-feature"><Text message="Featured now"/></span>:null}<span className="featured-card-photo"><ProviderIdentity provider={provider} size="large"/></span><span className={`featured-card-details ${presentation.details}`}><small><Text message="Transport Provider"/></small><strong>{provider.name}</strong><small>@{provider.handle}</small><small><Truck aria-hidden="true"/>{provider.fleet_size} <Text message={provider.fleet_size===1?'vehicle':'vehicles'}/></small><em>{walkthrough?.label}</em></span></button>;})}</div></div></div></div>
    <SponsoredProviders providers={sponsoredProviders}/>
    {selectedIndex!==null?<AccountPreview provider={providers[selectedIndex]} walkthrough={walkthroughs.find((item:any)=>item.provider_key===providers[selectedIndex]?.provider_key)} onClose={closePreview}/>:null}
  </div>;
}
