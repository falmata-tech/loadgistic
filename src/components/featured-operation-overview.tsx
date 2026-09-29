import Link from 'next/link';
import {CalendarDays,CheckCircle2,Clock3} from 'lucide-react';
import {Text} from './localization';
import {featuredRunState,featuredDayState} from '@/lib/featured-status.js';
type FeaturedDay={date:string;theme:string;status:string|null;source:string|null;selected:number;invalid:number;eligible:number;remaining:number};
export type FeaturedOverview={round:number;eligible:number;remaining:number;days:FeaturedDay[];run:{checked_at:string|null;succeeded_at:string|null;outcome:string;created_count:number;skipped_count:number;empty_count:number}};
const runLabels:Record<string,string>={READY:'Latest selection check succeeded',PAUSED:'Manual selection is on',NOT_RUN:'Automatic selection has not run yet',STALE:'Automatic selection needs a check',FAILED:'The last automatic selection failed'};
const dayLabels:Record<string,string>={DRAFT:'Draft — not public',PUBLISHED:'Published',NEEDS_REVIEW:'Selected truck or driver needs attention',NO_ELIGIBLE:'No eligible trucks for this type',ROUND_WAIT:'Waiting for other trucks to have their turn',NOT_PREPARED:'Not prepared yet'};
export function FeaturedOperationOverview({overview,mode}:{overview:FeaturedOverview;mode:string}){
 const state=featuredRunState(mode,overview.run);const ready=overview.days.filter(day=>featuredDayState(day,overview.remaining)==='PUBLISHED').length;
 const dateLabel=(value:string)=>new Date(value.length===10?value+'T12:00:00Z':value).toLocaleString('en-GB',{timeZone:'Africa/Addis_Ababa',...(value.length===10?{weekday:'short',month:'short',day:'numeric'}:{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} as Intl.DateTimeFormatOptions);
 return <section className="card featured-operation-overview" aria-labelledby="featured-overview-heading">
  <header>{state==='READY'?<CheckCircle2 aria-hidden="true"/>:<Clock3 aria-hidden="true"/>}<div><h2 id="featured-overview-heading"><Text message={runLabels[state]}/></h2><p><Text message="Last check"/>: {overview.run.checked_at?<time dateTime={overview.run.checked_at}>{dateLabel(overview.run.checked_at)} EAT</time>:<Text message="Not recorded"/>}</p></div></header>
  {state==='STALE'||state==='FAILED'||state==='NOT_RUN'?<p role="status"><Text message="Use Prepare upcoming days to check selection now. If this keeps happening, check the scheduled job before relying on automation."/></p>:null}
  <dl><div><dt><Text message="Days ready"/></dt><dd>{ready} / 7</dd></div><div><dt><Text message="Eligible truck-and-driver pairs"/></dt><dd>{overview.eligible}</dd></div><div><dt><Text message="Still waiting their turn"/></dt><dd>{overview.remaining}</dd></div></dl>
  <h3><CalendarDays aria-hidden="true"/><Text message="Next seven days"/></h3>
  <div className="featured-upcoming-days">{overview.days.map(day=><Link key={day.date} href={`/admin/featured?date=${day.date}#featured-day-editor`}><time dateTime={day.date}>{dateLabel(day.date)}</time><strong><Text message={day.theme}/></strong><span><Text message={dayLabels[featuredDayState(day,overview.remaining)]}/></span>{day.status?<small><Text message={day.source==='AUTO'?'Automatic':'Manual day'}/> · {day.selected} <Text message={day.selected===1?'Truck':'Trucks'}/></small>:null}</Link>)}</div>
  <details><summary><Text message="How automatic selection works"/></summary><p><Text message="Every 15 minutes, selection prepares missing days for the next week. Eligible truck-and-driver pairs are drawn randomly, without repeats until everyone has had a turn. Saved days are kept."/></p><p><Text message="A truck type may wait while other types finish the round. Fewer selected trucks receive longer slots within 08:30–12:00 EAT. A manual draft stays private until you publish it."/></p><p><Text message="Last check"/>: <Text message="Days prepared"/> {overview.run.created_count} · <Text message="Days kept"/> {overview.run.skipped_count} · <Text message="Days without a selection"/> {overview.run.empty_count}</p></details>
 </section>;
}
