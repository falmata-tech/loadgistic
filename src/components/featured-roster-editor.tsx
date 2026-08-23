"use client";

import React from 'react';
import {ArrowDown,ArrowUp,CalendarClock,Clock3,Coffee,Plus,RefreshCw,Trash2,Truck,UserRound} from 'lucide-react';
import {buildFeaturedDaySchedule,DEFAULT_FEATURED_SCHEDULE_CONFIG} from '@/lib/expo-broadcast.js';

type Candidate={provider_key:string;name:string;base_place:string;base_region:string;provider_kind:string;provider_kind_label:string;fleet_size:number};
type ManualInterval={providerKey:string;startTime:string;endTime:string};
type Sponsor={sponsor_name?:string;eligible?:boolean;starts_on?:string;ends_on?:string};

function ethiopiaTime(iso:string){
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Addis_Ababa',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
}

export function FeaturedRosterEditor({candidates,selectedProviderKeys,featureDate,defaultSchedule,defaultManualSchedule=[],sponsors=[]}:{candidates:Candidate[];selectedProviderKeys:string[];featureDate:string;defaultSchedule?:any;defaultManualSchedule?:ManualInterval[];sponsors?:Sponsor[]} ){
  const [selected,setSelected]=React.useState(selectedProviderKeys);
  const [candidateKey,setCandidateKey]=React.useState('');
  const [ready,setReady]=React.useState(false);
  const candidateSelect=React.useRef(null as HTMLSelectElement|null);
  const [mode,setMode]=React.useState((defaultSchedule?.mode==='MANUAL'?'MANUAL':'AUTO') as 'AUTO'|'MANUAL');
  const [config,setConfig]=React.useState({...DEFAULT_FEATURED_SCHEDULE_CONFIG,...(defaultSchedule?.config||{})} as any);
  const [manual,setManual]=React.useState(defaultManualSchedule as ManualInterval[]);
  const byKey=React.useMemo(()=>new Map(candidates.map(candidate=>[candidate.provider_key,candidate])),[candidates]);
  const available=candidates.filter(candidate=>!selected.includes(candidate.provider_key));
  React.useEffect(()=>setReady(true),[]);

  let schedule:any=null;
  let scheduleError='';
  try{
    schedule=buildFeaturedDaySchedule(featureDate,selected,{mode,config,manualSchedule:manual});
    const sponsorNames=sponsors.filter(item=>item.eligible!==false&&(!item.starts_on||item.starts_on<=featureDate)&&(!item.ends_on||item.ends_on>=featureDate)).map(item=>item.sponsor_name).filter(Boolean) as string[];
    let sponsorIndex=0;
    schedule={...schedule,entries:schedule.entries.map((entry:any)=>entry.type==='SPONSOR_BREAK'&&sponsorNames.length?{...entry,label:`Sponsor · ${sponsorNames[sponsorIndex++%sponsorNames.length]}`,sponsor_name:sponsorNames[(sponsorIndex-1)%sponsorNames.length]}:entry)};
  }
  catch(error){scheduleError=error instanceof Error&&error.message.includes('MANUAL')?'Give every selected transporter a valid morning or evening interval without overlaps.':'Check the session and break settings.';}
  const walkthroughByKey=new Map((schedule?.walkthroughs||[]).map((item:any)=>[item.provider_key,item]));

  function addProvider(){const nextKey=candidateKey||candidateSelect.current?.value||'';if(!nextKey||selected.includes(nextKey))return;setSelected((current:string[])=>[...current,nextKey]);setCandidateKey('');if(candidateSelect.current)candidateSelect.current.value='';}
  function move(index:number,direction:-1|1){setSelected((current:string[])=>{const next=[...current];const target=index+direction;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target],next[index]];return next;});}
  function updateConfig(key:string,value:string){setConfig((current:any)=>({...current,[key]:key.endsWith('Minutes')||key==='sponsorBreakEvery'?Number(value):value}));}
  function updateManual(providerKey:string,field:'startTime'|'endTime',value:string){setManual((current:ManualInterval[])=>{const existing=current.find((item:ManualInterval)=>item.providerKey===providerKey)||{providerKey,startTime:'',endTime:''};return [...current.filter((item:ManualInterval)=>item.providerKey!==providerKey),{...existing,[field]:value}];});}
  function switchMode(next:'AUTO'|'MANUAL'){
    if(next==='MANUAL'&&mode!=='MANUAL'){
      try{
        const automatic=buildFeaturedDaySchedule(featureDate,selected,{mode:'AUTO',config});
        setManual(automatic.walkthroughs.map((item:any)=>({providerKey:item.provider_key,startTime:ethiopiaTime(item.starts_at),endTime:ethiopiaTime(item.ends_at)})));
      }catch{setManual([]);}
    }
    setMode(next);
  }

  return <section className="panel featured-roster-editor"><div className="section-heading"><div><span className="section-kicker"><Truck aria-hidden="true"/>Featured transporter board</span><h2>Build today&apos;s featured roster</h2><p>Add eligible transporters and arrange the order used for the live programme.</p></div><strong className="featured-roster-count">{selected.length} {selected.length===1?'transporter':'transporters'}</strong></div>
    {selected.map((key:string)=><input key={key} type="hidden" name="providerKeys" value={key}/>) }
    <input type="hidden" name="scheduleMode" value={mode}/><input type="hidden" name="manualSchedule" value={JSON.stringify(manual.filter((item:ManualInterval)=>selected.includes(item.providerKey)))}/>
    <div className="featured-roster-add"><div className="form-group"><label htmlFor="featured-provider-add">Add an eligible transporter</label><select ref={candidateSelect} id="featured-provider-add" defaultValue="" disabled={!ready||!available.length} onChange={event=>setCandidateKey(event.target.value)}><option value="">Choose a transporter</option>{available.map(candidate=><option key={candidate.provider_key} value={candidate.provider_key}>{candidate.name} · {candidate.provider_kind_label} · {candidate.base_place}</option>)}</select></div><button className="button secondary" type="button" onClick={addProvider} disabled={!ready||!available.length}><Plus aria-hidden="true"/>Add transporter</button></div>
    {selected.length?<ol className="featured-roster-list">{selected.map((key:string,index:number)=>{const candidate=byKey.get(key);if(!candidate)return null;const walkthrough:any=walkthroughByKey.get(key);const manualInterval=manual.find((item:ManualInterval)=>item.providerKey===key);return <li key={key}><span className="featured-roster-position">{String(index+1).padStart(2,'0')}</span><span className="featured-roster-provider">{candidate.provider_kind==='SELF_MANAGED_DRIVER'?<UserRound aria-hidden="true"/>:<Truck aria-hidden="true"/>}<span><strong>{candidate.name}</strong><small>{candidate.provider_kind_label} · {candidate.base_place}, {candidate.base_region} · {candidate.fleet_size} active {candidate.fleet_size===1?'truck':'trucks'}</small></span></span>{mode==='MANUAL'?<span className="featured-manual-time"><label><small>Starts</small><input type="time" value={manualInterval?.startTime||''} onChange={event=>updateManual(key,'startTime',event.target.value)}/></label><label><small>Ends</small><input type="time" value={manualInterval?.endTime||''} onChange={event=>updateManual(key,'endTime',event.target.value)}/></label></span>:<span className="featured-roster-time"><Clock3 aria-hidden="true"/><span><small>{walkthrough?.session_label||'Presentation'}</small><strong>{walkthrough?.time_label||'Update settings'}</strong></span></span>}<span className="featured-roster-actions"><button type="button" onClick={()=>move(index,-1)} disabled={index===0} aria-label={`Move ${candidate.name} earlier`}><ArrowUp aria-hidden="true"/></button><button type="button" onClick={()=>move(index,1)} disabled={index===selected.length-1} aria-label={`Move ${candidate.name} later`}><ArrowDown aria-hidden="true"/></button><button type="button" className="danger" onClick={()=>{setSelected((current:string[])=>current.filter((item:string)=>item!==key));setManual((current:ManualInterval[])=>current.filter((item:ManualInterval)=>item.providerKey!==key));}} aria-label={`Remove ${candidate.name}`}><Trash2 aria-hidden="true"/></button></span></li>;})}</ol>:<p className="empty-state compact">No transporters selected yet. Add at least one before publishing.</p>}
    <div className="featured-broadcast-editor"><div className="featured-schedule-heading"><div><span className="section-kicker"><CalendarClock aria-hidden="true"/>Daily live schedule</span><h3>Plan two focused presentation sessions</h3><p>Automatic mode shares presentation time equally. Changeovers, Sponsor breaks, and the four-hour midday intermission remain separate.</p></div><div className="featured-schedule-mode" role="group" aria-label="Schedule mode"><button type="button" className={mode==='AUTO'?'active':''} onClick={()=>switchMode('AUTO')}><RefreshCw aria-hidden="true"/>Automatic</button><button type="button" className={mode==='MANUAL'?'active':''} onClick={()=>switchMode('MANUAL')}><Clock3 aria-hidden="true"/>Manual</button></div></div>
      <div className="featured-schedule-settings">
        <label><span>Day opens</span><input name="scheduleDayStart" type="time" value={config.dayStart} onChange={event=>updateConfig('dayStart',event.target.value)} required/></label>
        <label><span>Morning ends</span><input name="scheduleMorningEnd" type="time" value={config.morningEnd} onChange={event=>updateConfig('morningEnd',event.target.value)} required/></label>
        <label><span>Evening begins</span><input name="scheduleEveningStart" type="time" value={config.eveningStart} onChange={event=>updateConfig('eveningStart',event.target.value)} required/></label>
        <label><span>Day closes</span><input name="scheduleDayEnd" type="time" value={config.dayEnd} onChange={event=>updateConfig('dayEnd',event.target.value)} required/></label>
        <label><span>Target per transporter</span><select name="targetPresentationMinutes" value={config.targetPresentationMinutes} onChange={event=>updateConfig('targetPresentationMinutes',event.target.value)}>{[15,20,25,30,40,45,60].map(value=><option key={value} value={value}>{value} minutes</option>)}</select></label>
        <label><span>Changeover</span><select name="transitionMinutes" value={config.transitionMinutes} onChange={event=>updateConfig('transitionMinutes',event.target.value)}>{[5,10,15,20,25,30].map(value=><option key={value} value={value}>{value} minutes</option>)}</select></label>
        <label><span>Sponsor break after</span><select name="sponsorBreakEvery" value={config.sponsorBreakEvery} onChange={event=>updateConfig('sponsorBreakEvery',event.target.value)}>{[2,3,4,5,6].map(value=><option key={value} value={value}>{value} transporters</option>)}</select></label>
        <label><span>Sponsor break length</span><select name="sponsorBreakMinutes" value={config.sponsorBreakMinutes} onChange={event=>updateConfig('sponsorBreakMinutes',event.target.value)}>{[10,15,20,25,30,45].map(value=><option key={value} value={value}>{value} minutes</option>)}</select></label>
      </div>
      <p className="featured-intermission-note"><Coffee aria-hidden="true"/>The midday intermission is fixed at four hours. Keep the morning end and evening start four hours apart.</p>
      {scheduleError?<p className="field-error" role="alert">{scheduleError}</p>:schedule?<div className="featured-schedule-preview"><div className="featured-session-summary">{schedule.sessions.map((session:any)=><span key={session.key}><small>{session.label}</small><strong>{session.time_label}</strong><em>{session.provider_count} {session.provider_count===1?'transporter':'transporters'}</em></span>)}</div><ol className="featured-schedule-timeline" tabIndex={0} aria-label="Generated presentation schedule; scroll horizontally for every entry">{schedule.entries.map((entry:any,index:number)=><li key={`${entry.type}-${entry.starts_at}-${index}`} className={entry.type.toLowerCase().replace('_','-')}><span>{entry.time_label}</span><strong>{entry.type==='PROVIDER'?byKey.get(entry.provider_key)?.name:entry.label}</strong><small>{entry.session_label||'Four-hour break'}</small></li>)}</ol></div>:null}
    </div>
  </section>;
}
