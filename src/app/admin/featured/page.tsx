import Link from 'next/link';
import { BadgeDollarSign,CalendarDays,CheckCircle2,ExternalLink,MapPin,Save,ShieldAlert,Sparkles } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminFeaturedProviderDay,listFeaturedProviderCandidates } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { providerRegionLabel,regionalExpoWeekForDate } from '@/lib/provider-regions.js';
import { FeaturedRosterEditor } from '@/components/featured-roster-editor';
import { SponsorAdminForm } from '@/components/sponsor-admin-form';

export const dynamic='force-dynamic';

function parseManualSchedule(value:unknown){
  try{const parsed=JSON.parse(String(value||'[]'));return Array.isArray(parsed)?parsed:[];}catch{return [];}
}

export default async function AdminFeaturedPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN'],{allowLimited:true});
  const query=await searchParams;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=query.date||today;
  const stored=getAdminFeaturedProviderDay(user,date);
  const expo=stored.expo!;
  const expoWeek=regionalExpoWeekForDate(date);
  const candidates:any[]=listFeaturedProviderCandidates(user,date);
  const eligible=candidates.filter((item:any)=>item.eligible);
  const selectedProviderKeys=stored.slots.map((slot:any)=>slot.provider_organization_id?`organization:${slot.provider_organization_id}`:`profile:${slot.provider_profile_id}`);
  const excluded=candidates.filter((item:any)=>!item.eligible);
  const rosterGaps=stored.slotEvaluations.filter((slot:any)=>!slot.eligible);
  return <div className="page featured-admin-page">
    <PageHeader title="Daily Featured Transporters" subtitle="Build the featured board, schedule the live presentation, and manage sponsors."/>
    <Flash error={query.error} success={query.success}/>
    <section className="panel featured-admin-picker">
      <form method="get" className="featured-day-filter regional-expo-admin-filter">
        <div className="form-group"><label htmlFor="feature-date"><CalendarDays aria-hidden="true"/>Feature date</label><input id="feature-date" name="date" type="date" defaultValue={date} required/></div>
        <div className="featured-expo-assignment"><MapPin aria-hidden="true"/><span><small>{expo.day} feature</small><strong>{expo.title}</strong></span></div>
        <button className="button secondary">Load transporters</button>
      </form>
      <div className="regional-expo-week admin" role="region" tabIndex={0} aria-label="Featured regions for the week; scroll horizontally for every day">{expoWeek.map(group=><span className={group.key===expo.key?'current':''} key={group.key}><small>{group.day.slice(0,3)} · {group.dateLabel}</small><strong>{group.shortTitle}</strong></span>)}</div>
      <div className="featured-admin-status"><span><strong>{eligible.length}</strong> eligible transporters from {expo.regionCodes.map(providerRegionLabel).join(', ')}</span><span><strong>{stored.day?.status||'NEW'}</strong> {stored.day?`for ${expo.title}`:'schedule'}</span></div>
    </section>
    <form action="/api/admin/featured" method="post" className="featured-admin-form">
      <input type="hidden" name="featureDate" value={date}/>
      {rosterGaps.length?<div className="flash error"><ShieldAlert aria-hidden="true"/>{rosterGaps.length} published position{rosterGaps.length===1?' is':'s are'} now hidden because the transporter no longer meets the feature rules. Choose an eligible replacement and publish again.</div>:null}
      <FeaturedRosterEditor candidates={eligible} selectedProviderKeys={selectedProviderKeys} featureDate={date} defaultSchedule={stored.schedule} defaultManualSchedule={parseManualSchedule(stored.day?.manual_schedule_json)} sponsors={stored.sponsorships}/>
      <section className="panel featured-event-settings"><div className="section-heading"><div><span className="section-kicker"><Sparkles aria-hidden="true"/>Public board presentation</span><h2>Set today&apos;s featured-transporter message</h2><p>Keep the public programme current with a concise headline, introduction, and presentation schedule.</p></div></div><div className="featured-presentation-grid"><div className="form-group"><label htmlFor="feature-headline">Public headline</label><input id="feature-headline" name="publicHeadline" maxLength={90} defaultValue={stored.day?.public_headline||''} placeholder={`${expo.title} Daily Featured Transporters`}/></div><div className="form-group featured-introduction-field"><label htmlFor="feature-introduction">Short introduction</label><textarea id="feature-introduction" name="publicIntroduction" minLength={10} maxLength={240} defaultValue={stored.day?.public_introduction||''} placeholder={`Meet reviewed fleet transporters, owner-operators, and self-managed drivers based across ${expo.title}.`}/></div><div className="form-group"><label htmlFor="feature-tiktok"><ExternalLink aria-hidden="true"/>TikTok live event link (optional)</label><input id="feature-tiktok" name="tiktokUrl" type="url" inputMode="url" defaultValue={stored.day?.tiktok_url||''} placeholder="https://www.tiktok.com/@loadgistic/live"/><small>One event link for the programme. Featured portraits lead to transporter details and current trucks.</small></div></div></section>
      {excluded.length?<details className="panel featured-exclusions"><summary><ShieldAlert aria-hidden="true"/>{excluded.length} transporter{excluded.length===1?'':'s'} based here need review before featuring</summary><div>{excluded.map((item:any)=><article key={item.provider_key}><strong>{item.name}</strong><span>{item.reasons.join(' · ')}</span></article>)}</div></details>:null}
      <div className="sticky-form-actions"><button className="button secondary" name="command" value="DRAFT"><Save aria-hidden="true"/>Save draft</button><button className="button" name="command" value="PUBLISH"><CheckCircle2 aria-hidden="true"/>Publish this day</button><Link className="button ghost" href="/">View homepage</Link></div>
    </form>
    <section className="panel featured-sponsor-admin"><div className="section-heading"><div><span className="section-kicker"><BadgeDollarSign aria-hidden="true"/>Sponsored</span><h2>Sponsors</h2><p>Schedule up to five Loadgistic transporters or outside advertisers for this regional programme. Sponsor placement never changes Market or featured-roster order.</p></div></div>
      <SponsorAdminForm featureDate={date} candidates={eligible}/>
      {stored.sponsorships.length?<div className="featured-sponsor-schedules">{stored.sponsorships.map((sponsorship:any)=><article key={sponsorship.id}><div><small>Position {sponsorship.position} · {sponsorship.starts_on} to {sponsorship.ends_on}</small><strong>{sponsorship.sponsor_name}</strong><span>{sponsorship.sponsor_kind==='ADVERTISER'?'Outside advertiser':sponsorship.candidate?.base_place||'Loadgistic transporter'}</span><span className={sponsorship.eligible?'status green':'status yellow'}>{sponsorship.eligible?'Ready':'Needs review'}</span></div><form action="/api/admin/featured" method="post"><input type="hidden" name="featureDate" value={date}/><input type="hidden" name="sponsorshipId" value={sponsorship.id}/><button className="button secondary" name="command" value="DISABLE_SPONSOR">Disable</button></form></article>)}</div>:<p className="empty-state compact">No active or upcoming sponsors are scheduled for this regional group.</p>}
    </section>
  </div>;
}
