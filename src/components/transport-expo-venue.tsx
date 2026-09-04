"use client";

import React from 'react';
import Link from 'next/link';
import {BadgeDollarSign,Building2,CalendarDays,ChevronDown,Clock3,ExternalLink,MapPin,Phone,Play,ShieldCheck,Truck,UserRound,X} from 'lucide-react';
import {buildFeaturedDaySchedule} from '@/lib/expo-broadcast.js';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';

function ProviderIdentity({provider}:{provider:any}){
  return <img src={provider.profile_image_url||'/marketing/default-transporter-profile.png'} alt=""/>;
}

function TruckPreview({truck,walkthrough,onClose}:{truck:any;walkthrough:any;onClose:()=>void}){
  const dialogRef=React.useRef(null as HTMLDialogElement|null);
  React.useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;dialog.showModal();return()=>{if(dialog.open)dialog.close();};},[]);
  const truckName=truck.vehicle_label||[truck.vehicle_make,truck.vehicle_model].filter(Boolean).join(' ')||truck.cargo_configuration;
  return <dialog ref={dialogRef} className="expo-provider-dialog featured-truck-dialog" aria-labelledby="featured-truck-dialog-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialogRef.current)onClose();}}>
    <article>
      <button type="button" onClick={onClose} aria-label="Close featured truck details"><X aria-hidden="true"/></button>
      <div className="featured-truck-dialog-visual"><img src={vehicleConfigurationImage(truck.cargo_configuration)} alt={`${truck.cargo_configuration} operated by ${truck.driver_first_name}`}/></div>
      <div className="featured-truck-dialog-copy"><small>{truck.cargo_configuration}</small><h3 id="featured-truck-dialog-title">{truckName}</h3><p><UserRound aria-hidden="true"/>{truck.driver_first_name} · {truck.driver_kind_label}</p><p><Building2 aria-hidden="true"/>{truck.name}</p><p><MapPin aria-hidden="true"/>{truck.base_place}</p></div>
      <div className="featured-truck-dialog-time"><Clock3 aria-hidden="true"/><span><small>Programme time</small><strong>{walkthrough?.label||'07:30–09:00 EAT'}</strong></span></div>
      <div className="expo-dialog-actions"><Link className="button" href={`/@${encodeURIComponent(truck.handle)}`}><Building2 aria-hidden="true"/>Transporter profile</Link><Link className="button secondary" href={`/?q=${encodeURIComponent(truck.platform_number||truck.cargo_configuration)}`}><Truck aria-hidden="true"/>Find this truck</Link></div>
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
    <header><span><BadgeDollarSign aria-hidden="true"/>Sponsored</span><h3 id="sponsored-provider-title">Sponsors</h3></header>
    <div aria-live="off">{visible.map(provider=>provider.sponsor_kind==='ADVERTISER'
      ?<article key={`advertiser-${provider.sponsor_position}-${provider.name}`} className="expo-sponsored-card advertiser"><span className="expo-sponsor-mark" aria-hidden="true"><Building2/></span><span><small>Advertiser</small><strong>{provider.name}</strong><p>{provider.description}</p><span className="expo-sponsored-actions">{provider.website_url?<a href={provider.website_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/>Website</a>:null}{provider.phone?<a href={`tel:${provider.phone}`}><Phone aria-hidden="true"/>Call</a>:null}</span></span></article>
      :<article key={`transporter-${provider.sponsor_position}-${provider.handle}`} className="expo-sponsored-card"><ProviderIdentity provider={provider}/><span><small>Transporter</small><strong>{provider.name}</strong><span className="expo-sponsored-actions"><Link href={`/@${encodeURIComponent(provider.handle)}`}><Building2 aria-hidden="true"/>Profile</Link><Link href={`/?q=${encodeURIComponent(provider.name)}`}><Truck aria-hidden="true"/>Trucks</Link></span></span></article>)}</div>
    <p><ShieldCheck aria-hidden="true"/>Confirm sponsor claims and terms directly.</p>
  </aside>;
}

function assignSponsorNames(schedule:any,providers:any[]){
  const names=providers.map(provider=>provider.name).filter(Boolean);let index=0;if(!names.length)return schedule;
  return {...schedule,entries:schedule.entries.map((entry:any)=>entry.type==='PROGRAMME_BREAK'?{...entry,label:`Sponsor · ${names[index++%names.length]}`}:entry)};
}

function scheduleTime(iso:string){return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Addis_Ababa',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}
function featuredDateLabel(value:string){return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00Z`));}

export function TransportExpoVenue({providers,sponsoredProviders=[],featureDate,initialSchedule,week=[],expoGroup,tiktokUrl}:{providers:any[];sponsoredProviders?:any[];featureDate:string;initialSchedule:any;week?:any[];expoGroup:any;tiktokUrl?:string|null}){
  const [selectedIndex,setSelectedIndex]=React.useState(null as number|null);const selectedTriggerRef=React.useRef(null as HTMLButtonElement|null);const [now,setNow]=React.useState(()=>Date.now());
  const truckKeys=React.useMemo(()=>providers.map(provider=>provider.truck_key),[providers]);
  const manualSchedule=React.useMemo(()=>initialSchedule?.mode==='MANUAL'?(initialSchedule.walkthroughs||[]).map((item:any)=>({providerKey:item.provider_key,startTime:scheduleTime(item.starts_at),endTime:scheduleTime(item.ends_at)})):[],[initialSchedule]);
  const schedule=React.useMemo(()=>assignSponsorNames(buildFeaturedDaySchedule(featureDate,truckKeys,{mode:initialSchedule?.mode||'AUTO',config:initialSchedule?.config||{},manualSchedule},now),sponsoredProviders),[featureDate,truckKeys,initialSchedule?.mode,initialSchedule?.config,manualSchedule,now,sponsoredProviders]);
  const walkthroughs=schedule.walkthroughs as any[];const currentIndex=walkthroughs.findIndex((item:any)=>item.current);const active=schedule.active_entry;
  React.useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[]);
  function closePreview(){setSelectedIndex(null);window.requestAnimationFrame(()=>selectedTriggerRef.current?.focus());}
  const stateLabel=schedule.phase==='live'?'Live':schedule.phase==='break'?'Interlude':schedule.phase==='ended'?'Ended':'Scheduled';
  return <div className={`transport-expo-experience featured-truck-experience${sponsoredProviders.length?'':' without-sponsors'}`}>
    <div className="featured-programme-command">
      <span className="featured-programme-current"><CalendarDays aria-hidden="true"/><span><small>{featuredDateLabel(featureDate)}</small><strong>{expoGroup.label} · {providers.length} trucks</strong></span></span>
      <details className="regional-expo-week-panel" name="featured-programme-panel"><summary aria-label="View this week’s featured truck types"><CalendarDays aria-hidden="true"/><span>Week</span><ChevronDown aria-hidden="true"/></summary><div className="regional-expo-week" role="region" aria-label="Weekly featured truck types">{week.map((group:any)=><span className={group.key===expoGroup.key?'current':''} key={group.key}><small>{group.day.slice(0,3)} · {group.dateLabel}</small><strong>{group.shortLabel||group.label}</strong>{group.key===expoGroup.key?<em>Today</em>:null}</span>)}</div></details>
      <details className="expo-schedule-panel" name="featured-programme-panel"><summary className={`expo-live-strip ${schedule.phase}`} aria-label={`${stateLabel}. 07:30–09:00 EAT. View schedule`}><Clock3 aria-hidden="true"/><span>{stateLabel}</span><ChevronDown aria-hidden="true"/></summary><div className="expo-programme-detail"><strong>{currentIndex>=0?`Live · ${providers[currentIndex]?.cargo_configuration} with ${providers[currentIndex]?.driver_first_name}`:`Morning programme · ${stateLabel}`}</strong><small>07:30–09:00 EAT</small><div className="expo-programme-strip" role="region" tabIndex={0} aria-label="Featured truck programme">{schedule.entries.map((entry:any,index:number)=><span key={`${entry.type}-${entry.starts_at}-${index}`} className={`${entry.type.toLowerCase().replace('_','-')}${active?.starts_at===entry.starts_at&&active?.type===entry.type?' active':''}`}><small>{entry.time_label}</small><strong>{entry.type==='PROVIDER'?providers.find(provider=>provider.truck_key===entry.provider_key)?.cargo_configuration:entry.label}</strong></span>)}</div></div></details>
      {tiktokUrl?<a className="featured-programme-action live" href={tiktokUrl} target="_blank" rel="noreferrer"><Play aria-hidden="true"/><span>Live</span><ExternalLink aria-hidden="true"/></a>:null}
      <Link className="featured-programme-action" href="/" aria-label="Find open transport capacity"><Truck aria-hidden="true"/><span>Capacity</span></Link>
    </div>
    <div className="transport-expo-venue"><div className="featured-board-stage" aria-label={`${expoGroup.label} featured truck board`}><div className="featured-board-surface"><div className="featured-board-grid">{providers.map((truck,index)=>{const walkthrough=walkthroughs.find((item:any)=>item.provider_key===truck.truck_key);const isCurrent=Boolean(walkthrough?.current);const truckName=truck.vehicle_label||[truck.vehicle_make,truck.vehicle_model].filter(Boolean).join(' ')||truck.cargo_configuration;return <button key={truck.truck_key} type="button" className={`featured-provider-tile featured-truck-tile${isCurrent?' walkthrough-current':''}${selectedIndex===index?' selected':''}`} onClick={event=>{selectedTriggerRef.current=event.currentTarget;setSelectedIndex(index);}} aria-label={`${truck.cargo_configuration}, Driver ${truck.driver_first_name}, ${truck.name}, ${walkthrough?.label}`}><span className="featured-card-number">{String(index+1).padStart(2,'0')}</span><span className="featured-card-feature">{isCurrent?'Live':'View'}</span><span className="featured-card-photo"><img src={vehicleConfigurationImage(truck.cargo_configuration)} alt=""/></span><span className="featured-card-details"><small>{truck.cargo_configuration}</small><strong>{truckName}</strong><small><UserRound aria-hidden="true"/>{truck.driver_first_name} · {truck.driver_kind_label}</small><small><Building2 aria-hidden="true"/>{truck.name}</small><em>{walkthrough?.label}</em></span></button>;})}</div></div></div></div>
    <SponsoredProviders providers={sponsoredProviders}/>
    {selectedIndex!==null?<TruckPreview truck={providers[selectedIndex]} walkthrough={walkthroughs.find((item:any)=>item.provider_key===providers[selectedIndex]?.truck_key)} onClose={closePreview}/>:null}
  </div>;
}
