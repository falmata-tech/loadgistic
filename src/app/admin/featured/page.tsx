
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import { BadgeDollarSign,CalendarDays,CheckCircle2,ExternalLink,Save,ShieldAlert,Sparkles,Truck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminFeaturedProviderDay } from '@/lib/platform-admin.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { featuredTruckTypeForDate,featuredTruckWeekForDate } from '@/lib/featured-trucks.js';
import { FeaturedRosterEditor } from '@/components/featured-roster-editor';
import { SponsorAdminForm } from '@/components/sponsor-admin-form';
import {getPlatformControls} from '@/lib/platform-controls.js';
import {FeaturedControlsForm} from '@/components/platform-controls-form';

export const dynamic='force-dynamic';

function parseManualSchedule(value:unknown){
  try{const parsed=JSON.parse(String(value||'[]'));return Array.isArray(parsed)?parsed:[];}catch{return [];}
}

export default async function AdminFeaturedPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN'],{allowLimited:true});
  const query=await searchParams;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=query.date||today;
  const stored=await getAdminFeaturedProviderDay(user,date);
  const controls=await getPlatformControls(user);
  const theme=featuredTruckTypeForDate(date);
  const featuredWeek=featuredTruckWeekForDate(date);
  const candidates:any[]=stored.candidates;
  const eligible=candidates.filter((item:any)=>item.eligible);
  const selectedProviderKeys=stored.slots.filter((slot:any)=>slot.vehicle_id).map((slot:any)=>`vehicle:${slot.vehicle_id}`);
  const excluded=candidates.filter((item:any)=>!item.eligible);
  const rosterGaps=stored.slotEvaluations.filter((slot:any)=>!slot.eligible);
  return <div className="page featured-admin-page">
    <PageHeader title={<Text message="Daily Featured Trucks"/>} subtitle={<Text message="Choose the trucks and Drivers for the 07:30–09:00 programme."/>}/>
    <Flash error={query.error} success={query.success}/>
    <FeaturedControlsForm controls={controls}/>
    <section className="panel featured-admin-picker">
      <form method="get" className="featured-day-filter regional-expo-admin-filter">
        <div className="form-group"><label htmlFor="feature-date"><CalendarDays aria-hidden="true"/><Text message="Feature date"/></label><input id="feature-date" name="date" type="date" defaultValue={date} required/></div>
        <div className="featured-expo-assignment"><Truck aria-hidden="true"/><span><small><Text message="Truck type"/></small><strong>{theme.label}</strong></span></div>
        <button className="button secondary"><Text message="Load day"/></button>
      </form>
      <Localized as="div" copy={["aria-label"]} className="regional-expo-week admin" role="region" tabIndex={0} aria-label="Featured truck types for the week">{featuredWeek.map(group=><span className={group.key===theme.key?'current':''} key={group.key}><small>{group.day.slice(0,3)} · {group.dateLabel}</small><strong>{group.shortLabel}</strong></span>)}</Localized>
      <div className="featured-admin-status"><span><strong>{eligible.length}</strong><Text message=" eligible truck-and-Driver choices"/></span><span><strong>{stored.day?.status||'NEW'}</strong> {theme.label}</span></div>
    </section>
    <form action="/api/admin/featured" method="post" className="featured-admin-form">
      <input type="hidden" name="featureDate" value={date}/>
      {rosterGaps.length?<div className="flash error"><ShieldAlert aria-hidden="true"/>{rosterGaps.length}<Text message=" selected truck or Driver record needs replacement before republishing."/></div>:null}
      <FeaturedRosterEditor key={date} candidates={eligible} selectedProviderKeys={selectedProviderKeys} featureDate={date} defaultSchedule={stored.schedule} defaultManualSchedule={parseManualSchedule(stored.day?.manual_schedule_json)} sponsors={stored.sponsorships}/>
      <section className="panel featured-event-settings"><div className="section-heading"><div><span className="section-kicker"><Sparkles aria-hidden="true"/><Text message="Public presentation"/></span><h2><Text message="Programme message"/></h2></div></div><div className="featured-presentation-grid"><div className="form-group"><label htmlFor="feature-headline"><Text message="Headline"/></label><input id="feature-headline" name="publicHeadline" maxLength={90} defaultValue={stored.day?.public_headline||''} placeholder={`${theme.label} · Daily Featured`}/></div><div className="form-group featured-introduction-field"><label htmlFor="feature-introduction"><Text message="Short introduction"/></label><textarea id="feature-introduction" name="publicIntroduction" minLength={10} maxLength={240} defaultValue={stored.day?.public_introduction||''} placeholder={`Meet today’s ${theme.label.toLowerCase()} and the Drivers operating them.`}/></div><div className="form-group"><label htmlFor="feature-tiktok"><ExternalLink aria-hidden="true"/><Text message="Live link (optional)"/></label><Localized as="input" copy={["placeholder"]} id="feature-tiktok" name="tiktokUrl" type="url" inputMode="url" defaultValue={stored.day?.tiktok_url||''} placeholder="https://www.tiktok.com/@loadgistic/live"/></div></div></section>
      {excluded.length?<details className="panel featured-exclusions"><summary><ShieldAlert aria-hidden="true"/>{excluded.length}<Text message=" truck"/>{excluded.length===1?'':'s'}<Text message=" need review before featuring"/></summary><div>{excluded.map((item:any)=><article key={item.truck_key}><strong>{item.cargo_configuration}</strong><span>{item.reasons?.join(' · ')||'Truck or Driver is not ready'}</span></article>)}</div></details>:null}
      <div className="sticky-form-actions"><button className="button secondary" name="command" value="DRAFT"><Save aria-hidden="true"/><Text message="Save draft"/></button><button className="button" name="command" value="PUBLISH"><CheckCircle2 aria-hidden="true"/><Text message="Publish this day"/></button><Link className="button ghost" href="/featured"><Text message="View public programme"/></Link></div>
    </form>
    <section className="panel featured-sponsor-admin"><div className="section-heading"><div><span className="section-kicker"><BadgeDollarSign aria-hidden="true"/><Text message="Sponsored"/></span><h2><Text message="Sponsors"/></h2><p><Text message="Schedule up to five Loadgistic transporters or outside advertisers. Sponsorship never changes capacity results or featured-truck order."/></p></div></div>
      <SponsorAdminForm featureDate={date} candidates={(stored as any).providerCandidates||[]}/>
      {stored.sponsorships.length?<div className="featured-sponsor-schedules">{stored.sponsorships.map((sponsorship:any)=><article key={sponsorship.id}><div><small><Text message="Position "/>{sponsorship.position} · {sponsorship.starts_on}<Text message=" to "/>{sponsorship.ends_on}</small><strong>{sponsorship.sponsor_name}</strong><span>{sponsorship.sponsor_kind==='ADVERTISER'?<Text message="Outside advertiser"/>:sponsorship.candidate?.base_place||'Loadgistic transporter'}</span><span className={sponsorship.eligible?'status green':'status yellow'}>{sponsorship.eligible?<Text message="Ready"/>:<Text message="Needs review"/>}</span></div><form action="/api/admin/featured" method="post"><input type="hidden" name="featureDate" value={date}/><input type="hidden" name="sponsorshipId" value={sponsorship.id}/><button className="button secondary" name="command" value="DISABLE_SPONSOR"><Text message="Disable"/></button></form></article>)}</div>:<p className="empty-state compact"><Text message="No active or upcoming sponsors are scheduled."/></p>}
    </section>
  </div>;
}
