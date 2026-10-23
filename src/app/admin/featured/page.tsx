import {DatePicker} from '@/components/date-picker';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import {FeaturedOperationOverview} from '@/components/featured-operation-overview';
import {getFeaturedOverview} from '@/lib/featured-automation.js';
import styles from '@/app/admin/admin-presentation.module.css';
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import { BadgeDollarSign,CalendarDays,CheckCircle2,ExternalLink,Play,Radio,Save,ShieldAlert,Sparkles,Truck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminFeaturedProviderDay } from '@/lib/platform-admin.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { featuredTruckTypeForDate,featuredTruckWeekForDate } from '@/lib/featured-trucks.js';
import { FeaturedRosterEditor } from '@/components/featured-roster-editor';
import { SponsorAdminForm } from '@/components/sponsor-admin-form';
import {getFeaturedControls} from '@/lib/platform-controls.js';
import {hasPlatformPermission} from '@/lib/platform-admin.js';
import {notFound} from 'next/navigation';
import {FeaturedControlsForm,FeaturedPrepareForm} from '@/components/platform-controls-form';
import {featuredTikTokPresentation} from '@/lib/featured-tiktok-presentation.js';

export const dynamic='force-dynamic';

function parseManualSchedule(value:unknown){
  if(Array.isArray(value))return value;
  try{const parsed=JSON.parse(String(value||'[]'));return Array.isArray(parsed)?parsed:[];}catch{return [];}
}

export default async function AdminFeaturedPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});
  if(!hasPlatformPermission(user,'FEATURED'))notFound();
  const query=await searchParams;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=query.date||today;
  const editing=query.edit==='day';
  const stored=await getAdminFeaturedProviderDay(user,date);
  const controls=await getFeaturedControls(user);
  const overview=await getFeaturedOverview(user);
  const theme=featuredTruckTypeForDate(date);
  const featuredWeek=featuredTruckWeekForDate(date);
  const candidates:any[]=stored.candidates;
  const eligible=candidates.filter((item:any)=>item.eligible);
  const selectedProviderKeys=stored.slots.filter((slot:any)=>slot.vehicle_id).map((slot:any)=>`vehicle:${slot.vehicle_id}`);
  const excluded=candidates.filter((item:any)=>!item.eligible);
  const rosterGaps=stored.slotEvaluations.filter((slot:any)=>!slot.eligible);
  const tiktokStatus=stored.day?.tiktok_broadcast_status||'NOT_SCHEDULED';
  const tiktok=featuredTikTokPresentation(tiktokStatus,Boolean(stored.day?.tiktok_url));
  const tiktokStart=stored.schedule?.config?.dayStart||'08:30';
  return <div className={"page featured-admin-page "+styles.workspace}>
    <PageHeader title={<Text message="Daily Featured Vehicles"/>}/>
    <Flash error={query.error} success={query.success}/>
    {!editing?<FeaturedOperationOverview overview={overview} mode={controls.featured_mode}/>:null}
    {!editing?<div className={styles.recordActions}>{controls.featured_mode==='AUTO'?<FeaturedPrepareForm/>:null}<WorkspaceTaskDialog title="Selection settings" triggerLabel="Selection settings"><FeaturedControlsForm controls={controls}/></WorkspaceTaskDialog></div>:null}

    <section id="featured-day-editor" className={styles.featuredDay}><header className={styles.featuredDayHeading}><div><h2><Text message={editing?'Edit programme':'Daily programme'}/></h2></div>{editing?<Link className="button secondary small" href={`/admin/featured?date=${date}`}><Text message="Cancel editing"/></Link>:<Link className="button secondary small" href={`/admin/featured?date=${date}&edit=day#featured-day-editor`}><Text message="Edit programme"/></Link>}</header>
    <section className="panel featured-admin-picker">
      <form method="get" className="featured-day-filter regional-expo-admin-filter">
        <div className="form-group"><label htmlFor="feature-date"><CalendarDays aria-hidden="true"/><Text message="Feature date"/></label><DatePicker id="feature-date" name="date"  defaultValue={date} required/></div>
        <div className="featured-expo-assignment"><Truck aria-hidden="true"/><span><small><Text message="Vehicle type"/></small><strong>{theme.label}</strong></span></div>
        <button className="button secondary"><Text message="Load day"/></button>
      </form>
      <Localized as="div" copy={["aria-label"]} className="regional-expo-week admin" role="region" tabIndex={0} aria-label="Featured vehicle types for the week">{featuredWeek.map(group=><span className={group.key===theme.key?'current':''} key={group.key}><small>{group.day.slice(0,3)} · {group.dateLabel}</small><strong>{group.shortLabel}</strong></span>)}</Localized>
      <div className="featured-admin-status"><span><strong>{eligible.length}</strong><Text message=" eligible vehicle-and-driver choices"/></span><span><strong><Text message={stored.day?.status==='PUBLISHED'?'Published':stored.day?.status==='DRAFT'?'Draft':'Not prepared yet'}/></strong> {theme.label}</span></div>
    </section>
    {editing?<form action="/api/admin/featured" method="post" className="featured-admin-form">
      <input type="hidden" name="featureDate" value={date}/>
      {rosterGaps.length?<div className="flash error"><ShieldAlert aria-hidden="true"/>{rosterGaps.length}<Text message=" selected vehicle or Driver record needs replacement before republishing."/></div>:null}
      <FeaturedRosterEditor key={date} candidates={eligible} selectedProviderKeys={selectedProviderKeys} featureDate={date} defaultSchedule={stored.schedule} defaultManualSchedule={parseManualSchedule(stored.day?.manual_schedule_json)} sponsors={stored.sponsorships}/>
      <section className="panel featured-event-settings"><div className="section-heading"><div><span className="section-kicker"><Sparkles aria-hidden="true"/><Text message="Public presentation"/></span><h2><Text message="Programme message"/></h2></div></div><div className="featured-presentation-grid"><div className="form-group"><label htmlFor="feature-headline"><Text message="Headline"/></label><Localized as="input" copy={["placeholder"]} id="feature-headline" name="publicHeadline" maxLength={90} defaultValue={stored.day?.public_headline||''} placeholder="Title for today's featured vehicles"/></div><div className="form-group featured-introduction-field"><label htmlFor="feature-introduction"><Text message="Short introduction"/></label><Localized as="textarea" copy={["placeholder"]} id="feature-introduction" name="publicIntroduction" minLength={10} maxLength={240} defaultValue={stored.day?.public_introduction||''} placeholder="Introduce the featured vehicles and their drivers."/></div><div className="form-group"><label htmlFor="feature-tiktok"><ExternalLink aria-hidden="true"/><Text message="Live link (optional)"/></label><Localized as="input" copy={["placeholder"]} id="feature-tiktok" name="tiktokUrl" type="url" inputMode="url" defaultValue={stored.day?.tiktok_url||''} placeholder="https://www.tiktok.com/@loadgistic/live"/></div></div></section>
      {excluded.length?<details className="panel featured-exclusions"><summary><ShieldAlert aria-hidden="true"/>{excluded.length}<Text message=" vehicle"/>{excluded.length===1?'':'s'}<Text message=" need review before featuring"/></summary><div>{excluded.map((item:any)=><article key={item.truck_key}><strong>{item.cargo_configuration}</strong><span>{item.reasons?.join(' · ')||'Vehicle or Driver is not ready'}</span></article>)}</div></details>:null}
      <div className="sticky-form-actions"><button className="button secondary" name="command" value="DRAFT"><Save aria-hidden="true"/><Text message="Save draft"/></button><button className="button" name="command" value="PUBLISH"><CheckCircle2 aria-hidden="true"/><Text message="Publish this day"/></button><Link className="button ghost" href="/featured"><Text message="View public programme"/></Link></div>
    </form>:<div className={styles.featuredReadRoster}>{stored.slotEvaluations.length?<ol>{stored.slotEvaluations.map((slot:any,index:number)=><li key={slot.id||slot.vehicle_id}><span>{index+1}</span><div><strong>{slot.candidate?.cargo_configuration||<Text message="Vehicle unavailable"/>}</strong><small>{slot.eligible?`${slot.candidate.driver_first_name} · ${slot.candidate.name}`:<Text message="Needs review"/>}</small></div><time>{stored.walkthroughs?.find((entry:any)=>entry.provider_key===`vehicle:${slot.vehicle_id}`)?.time_label||''}</time></li>)}</ol>:<p><Text message="Not prepared yet"/></p>}</div>}
    </section>
    {!editing&&stored.day?.status==='PUBLISHED'?<section className="panel featured-broadcast-admin" aria-labelledby="featured-broadcast-admin-title">
      <header><Radio aria-hidden="true"/><h2 id="featured-broadcast-admin-title"><Text message="TikTok Live"/></h2><span className={`featured-broadcast-admin-state ${tiktok.state}`}><Text message={tiktok.message} values={{time:tiktokStart}}/></span></header>
      {stored.day.tiktok_url?<><p><Text message="The vehicle schedule does not start TikTok. Start the broadcast in TikTok, then mark it Live here."/></p><a className="button secondary small" href={stored.day.tiktok_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/><Text message="Open TikTok link"/></a>
        {tiktokStatus==='LIVE'?<form action="/api/admin/featured" method="post"><input type="hidden" name="featureDate" value={date}/><button className="button secondary" name="command" value="TIKTOK_ENDED"><Radio aria-hidden="true"/><Text message="End TikTok Live"/></button></form>:tiktokStatus==='SCHEDULED'?<form action="/api/admin/featured" method="post"><input type="hidden" name="featureDate" value={date}/><button className="button" name="command" value="TIKTOK_LIVE"><Play aria-hidden="true"/><Text message="Mark TikTok LIVE"/></button></form>:null}
      </>:<p><Text message="No TikTok Live link saved. Add one while editing this programme."/></p>}
    </section>:null}
    {!editing?<>
    <section className="panel featured-sponsor-admin"><div className="section-heading"><div><span className="section-kicker"><BadgeDollarSign aria-hidden="true"/><Text message="Sponsored"/></span><h2><Text message="Sponsors"/></h2><p><Text message="Schedule up to five Loadgistic transporters or outside advertisers. Sponsorship never changes capacity results or featured-vehicle order."/></p></div></div>
      <WorkspaceTaskDialog title="Schedule sponsor" triggerLabel="Schedule sponsor"><SponsorAdminForm featureDate={date} candidates={(stored as any).providerCandidates||[]}/></WorkspaceTaskDialog>
      {stored.sponsorships.length?<div className="featured-sponsor-schedules">{stored.sponsorships.map((sponsorship:any)=><article key={sponsorship.id}><div><small><Text message="Position "/>{sponsorship.position} · {sponsorship.starts_on}<Text message=" to "/>{sponsorship.ends_on}</small><strong>{sponsorship.sponsor_name}</strong><span>{sponsorship.sponsor_kind==='ADVERTISER'?<Text message="Outside advertiser"/>:sponsorship.candidate?.base_place||'Loadgistic transporter'}</span><span className={sponsorship.eligible?'status green':'status yellow'}>{sponsorship.eligible?<Text message="Ready"/>:<Text message="Needs review"/>}</span></div><form action="/api/admin/featured" method="post"><input type="hidden" name="featureDate" value={date}/><input type="hidden" name="sponsorshipId" value={sponsorship.id}/><button className="button secondary" name="command" value="DISABLE_SPONSOR"><Text message="Disable"/></button></form></article>)}</div>:<p className="empty-state compact"><Text message="No active or upcoming sponsors are scheduled."/></p>}
    </section></>:null}
  </div>;
}
