'use client';

import React from 'react';
import {Check,ChevronDown,ChevronUp,Route} from 'lucide-react';
import {Text,useTranslation} from '@/components/localization';
import {TRACKING_JOURNEY,trackingNextStatuses,trackingProgress} from '@/lib/tracking-progress.js';

export const trackingStatusLabels:Record<string,string>={CREATED:'Tracking started',TO_PICKUP:'Going to pickup',LOADING:'Loading',IN_TRANSIT:'En route',UNLOADING:'Unloading',COMPLETED:'Complete',CANCELLED:'Tracking cancelled',ISSUE:'Problem'};

export function TrackingProgressPanel({status,recordedStatuses,children}:{status:string;recordedStatuses:string[];children?:React.ReactNode}){
  const {t}=useTranslation();const [open,setOpen]=React.useState(false),[ready,setReady]=React.useState(false),panelId=React.useId();
  React.useEffect(()=>setReady(true),[]);
  const next=trackingNextStatuses(status),nextJourney=next.filter((step:string)=>step!=='ISSUE');
  const nextMessage=status==='UNLOADING'?'Waiting for shipment owner approval':status==='ISSUE'?'Choose where the shipment resumes.':['COMPLETED','CANCELLED'].includes(status)?'No further status update is needed.':nextJourney.map((step:string)=>t(trackingStatusLabels[step]||step)).join(' · ');
  return <div className={`tracking-progress-float ${open?'is-open':''}`}>
    <button type="button" className="tracking-progress-toggle" disabled={!ready} aria-label={t('Shipment progress')} aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen((value:boolean)=>!value)}>
      <Route aria-hidden="true"/><span><small><Text message="Shipment progress"/></small><strong><Text message={trackingStatusLabels[status]||status}/></strong></span>{open?<ChevronDown aria-hidden="true"/>:<ChevronUp aria-hidden="true"/>}
    </button>
    <div id={panelId} hidden={!open} className="tracking-progress-body" role="region" aria-label={t('Shipment progress')}>
      <dl className="tracking-progress-state"><div><dt><Text message="Current"/></dt><dd><Text message={trackingStatusLabels[status]||status}/></dd></div><div className="tracking-progress-next"><dt><Text message="Next"/></dt><dd>{nextJourney.length&&status!=='ISSUE'?nextMessage:<Text message={nextMessage}/>}</dd></div></dl>
      {children||<><h2><Text message="All shipment steps"/></h2><ol className="tracking-journey tracking-readonly-journey" aria-label={t('Shipment progress')}>
        {TRACKING_JOURNEY.map((step:string,index:number)=>{
          const state=trackingProgress(step,status,recordedStatuses,next);
          return <li key={step} aria-current={state==='Current'?'step':undefined} data-state={state}><div className={`tracking-step ${state==='Completed'?'complete':state==='Current'?'current':'pending'}`}><span className="tracking-step-number" aria-hidden="true">{state==='Completed'?<Check/>:index+1}</span><span className="tracking-step-copy"><strong><Text message={trackingStatusLabels[step]}/></strong><span className="tracking-step-state"><Text message={state}/></span></span></div></li>;
        })}
      </ol>{status==='ISSUE'?<p className="permission-note warning"><Text message="Problem reported. Choose where the shipment resumes."/></p>:null}</>}
    </div>
  </div>;
}
