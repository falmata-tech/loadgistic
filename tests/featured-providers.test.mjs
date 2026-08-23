import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-featured-providers.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const {getDb}=await import('../src/lib/db.js');
const {buildFeaturedDaySchedule}=await import('../src/lib/expo-broadcast.js');

function ethiopiaDate(offset=0){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=new Date(`${today}T12:00:00.000Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);
}

test('Daily Featured Transporters follows the seven-day regional rotation, stays ordered, and is safely projected',()=>{
  const feature=repo.getDailyFeaturedProviders();
  assert.ok(feature);
  assert.equal(feature.feature_date,ethiopiaDate());
  assert.equal(feature.week.length,7);
  assert.equal(feature.base_place,feature.expo_group.title);
  assert.ok(feature.providers.length>0);
  assert.deepEqual(feature.providers.map(item=>item.position),feature.providers.map((_,index)=>index+1));
  assert.ok(feature.providers.every(item=>item.base_place&&item.base_region));
  assert.ok(feature.providers.every(item=>['FLEET_TRANSPORTER','OWNER_OPERATOR','SELF_MANAGED_DRIVER'].includes(item.provider_kind)));
  assert.equal(feature.walkthroughs.length,feature.providers.length);
  assert.equal(feature.schedule.sessions.length,2);
  assert.equal(Date.parse(feature.schedule.intermission.ends_at)-Date.parse(feature.schedule.intermission.starts_at),4*60*60*1000);
  assert.ok(feature.schedule.display_label.includes('Morning'));
  assert.ok(feature.schedule.display_label.includes('Evening'));
  assert.ok(feature.sponsored_providers.length>0&&feature.sponsored_providers.length<=5);
  assert.ok(feature.sponsored_providers.every(item=>item.sponsored===true));
  const serialized=JSON.stringify(feature);
  for(const privateKey of ['file_path','submitted_by','review_note','password_hash','contact_phone','contact_email'])assert.equal(serialized.includes(privateKey),false);
});

test('the seeded programme repairs a current Ethiopia-day gap but never invents a future roster',()=>{
  const db=getDb();
  const today=ethiopiaDate();
  db.prepare('DELETE FROM featured_provider_days WHERE feature_date=?').run(today);
  const repaired=repo.getDailyFeaturedProviders(today);
  assert.equal(repaired.published,true);
  assert.ok(repaired.providers.length>0);
  assert.match(db.prepare('SELECT id FROM featured_provider_days WHERE feature_date=?').get(today).id,/^featured-demo-/);

  const unscheduledDate=ethiopiaDate(20);
  const unscheduled=repo.getDailyFeaturedProviders(unscheduledDate);
  assert.equal(unscheduled.published,false);
  assert.equal(unscheduled.providers.length,0);
  assert.equal(unscheduled.week.length,7);
  assert.equal(db.prepare('SELECT 1 FROM featured_provider_days WHERE feature_date=?').get(unscheduledDate),undefined);
});

test('administrator schedules bounded sponsorship without changing featured-transporter order',()=>{
  const admin=repo.findUserByEmail('admin@loadgistic.local');
  const provider=repo.findUserByEmail('transporter@loadgistic.local');
  const featureDate=ethiopiaDate(3);
  const candidates=repo.listFeaturedProviderCandidates(admin,featureDate).filter(item=>item.eligible);
  assert.ok(candidates.length>=2);
  repo.saveFeaturedProviderDay(admin,{featureDate,providerKeys:[candidates[0].provider_key,candidates[1].provider_key],publicHeadline:'Regional freight providers ready to meet',publicIntroduction:'Open the venue to compare reviewed providers based in today’s regional programme.',scheduleConfig:{dayStart:'09:00',morningEnd:'12:00',eveningStart:'16:00',dayEnd:'21:00'},publish:true});
  assert.throws(()=>repo.saveProviderSponsorship(provider,{featureDate,providerKey:candidates[0].provider_key,startsOn:featureDate,endsOn:featureDate,position:1}),/FORBIDDEN/);
  const saved=repo.saveProviderSponsorship(admin,{featureDate,providerKey:candidates[1].provider_key,startsOn:featureDate,endsOn:featureDate,position:1});
  assert.equal(saved.sponsorships.some(item=>item.provider_key===candidates[1].provider_key),true);
  assert.throws(()=>repo.saveProviderSponsorship(admin,{featureDate,providerKey:candidates[0].provider_key,startsOn:featureDate,endsOn:featureDate,position:1}),/SPONSORSHIP_OVERLAP/);
  const feature=repo.getDailyFeaturedProviders(featureDate);
  assert.equal(feature.headline,'Regional freight providers ready to meet');
  assert.equal(feature.broadcast_start_time,'09:00');
  assert.equal(feature.broadcast_end_time,'21:00');
  assert.equal(feature.schedule.sessions[0].time_label,'11:30–12:00');
  assert.equal(feature.schedule.sessions[1].time_label,'20:30–21:00');
  assert.deepEqual(feature.providers.map(item=>item.handle),[candidates[0].handle,candidates[1].handle]);
  assert.deepEqual(feature.sponsored_providers.map(item=>item.handle),[candidates[1].handle]);
  const serialized=JSON.stringify(feature.sponsored_providers);
  for(const privateKey of ['provider_key','file_path','contact_phone','contact_email','created_by','updated_by'])assert.equal(serialized.includes(privateKey),false);
  const sponsorship=saved.sponsorships.find(item=>item.provider_key===candidates[1].provider_key);
  repo.disableProviderSponsorship(admin,sponsorship.id);
  assert.equal(repo.getDailyFeaturedProviders(featureDate).sponsored_providers.length,0);
});

test('administrator can schedule an outside advertiser and Sponsor breaks name it safely',()=>{
  const admin=repo.findUserByEmail('admin@loadgistic.local');
  const provider=repo.findUserByEmail('transporter@loadgistic.local');
  const featureDate=ethiopiaDate(4);
  const candidates=repo.listFeaturedProviderCandidates(admin,featureDate).filter(item=>item.eligible);
  assert.ok(candidates.length>=6);
  repo.saveFeaturedProviderDay(admin,{featureDate,providerKeys:candidates.slice(0,6).map(item=>item.provider_key),scheduleConfig:{sponsorBreakEvery:2},publish:true});
  const input={featureDate,sponsorKind:'ADVERTISER',businessName:'Blue Nile Tyres',description:'Commercial tyres and roadside support for freight operators.',websiteUrl:'https://example.com/blue-nile-tyres',phone:'+251911000111',startsOn:featureDate,endsOn:featureDate,position:1};
  assert.throws(()=>repo.saveProviderSponsorship(provider,input),/FORBIDDEN/);
  const saved=repo.saveProviderSponsorship(admin,input);
  const advertiser=saved.sponsorships.find(item=>item.sponsor_kind==='ADVERTISER');
  assert.equal(advertiser.sponsor_name,'Blue Nile Tyres');
  assert.ok(saved.schedule.entries.some(item=>item.type==='SPONSOR_BREAK'&&item.sponsor_name==='Blue Nile Tyres'));
  const feature=repo.getDailyFeaturedProviders(featureDate);
  assert.deepEqual(feature.sponsored_providers,[{
    sponsor_kind:'ADVERTISER',name:'Blue Nile Tyres',description:'Commercial tyres and roadside support for freight operators.',website_url:'https://example.com/blue-nile-tyres',phone:'+251911000111',sponsor_position:1,sponsored:true
  }]);
  assert.ok(feature.schedule.entries.some(item=>item.type==='SPONSOR_BREAK'&&item.label==='Sponsor · Blue Nile Tyres'));
  const serialized=JSON.stringify(feature.sponsored_providers);
  for(const privateKey of ['provider_key','created_by','updated_by','provider_profile_id','provider_organization_id'])assert.equal(serialized.includes(privateKey),false);
  repo.disableProviderSponsorship(admin,advertiser.id);
});

test('only an administrator can publish an exact-date ordered roster',()=>{
  const admin=repo.findUserByEmail('admin@loadgistic.local');
  const provider=repo.findUserByEmail('transporter@loadgistic.local');
  const featureDate=ethiopiaDate(1);
  const candidates=repo.listFeaturedProviderCandidates(admin,featureDate).filter(item=>item.eligible);
  assert.ok(candidates.length>=2);
  assert.throws(()=>repo.listFeaturedProviderCandidates(provider,featureDate),/FORBIDDEN/);
  repo.saveFeaturedProviderDay(admin,{featureDate,providerKeys:[candidates[1].provider_key,candidates[0].provider_key],tiktokUrl:'https://www.tiktok.com/@loadgistic/live',publish:true});
  const feature=repo.getDailyFeaturedProviders(featureDate);
  assert.deepEqual(feature.providers.map(item=>item.handle),[candidates[1].handle,candidates[0].handle]);
  assert.match(feature.tiktok_url,/^https:\/\/(www\.)?tiktok\.com\//);
  assert.throws(()=>repo.saveFeaturedProviderDay(admin,{featureDate:ethiopiaDate(2),providerKeys:[candidates[0].provider_key],tiktokUrl:'https://example.com/live',publish:true}),/FEATURED_TIKTOK_URL_INVALID/);
  assert.throws(()=>repo.saveFeaturedProviderDay(admin,{featureDate,providerKeys:[candidates[0].provider_key],scheduleConfig:{dayStart:'16:00',morningEnd:'12:00',eveningStart:'16:00',dayEnd:'22:00'},publish:true}),/FEATURED_SCHEDULE_WINDOW_INVALID/);
});

test('automatic schedule shares provider time equally and keeps operational breaks separate',()=>{
  const keys=Array.from({length:15},(_,index)=>`provider-${index+1}`);
  const schedule=buildFeaturedDaySchedule('2026-08-10',keys);
  assert.equal(schedule.walkthroughs.length,15);
  assert.equal(schedule.sessions[0].time_label,'08:00–13:00');
  assert.equal(schedule.sessions[1].time_label,'17:35–22:00');
  assert.equal(Date.parse(schedule.intermission.ends_at)-Date.parse(schedule.intermission.starts_at),4*60*60*1000);
  assert.deepEqual(new Set(schedule.walkthroughs.map(item=>(Date.parse(item.ends_at)-Date.parse(item.starts_at))/60000)),new Set([25]));
  assert.equal(schedule.entries.filter(item=>item.type==='SPONSOR_BREAK').length,4);
  assert.equal(schedule.entries.filter(item=>item.type==='TRANSITION').length,13);
});

test('small automatic rosters shrink toward late morning and late evening',()=>{
  const schedule=buildFeaturedDaySchedule('2026-08-10',['morning-provider','evening-provider']);
  assert.equal(schedule.sessions[0].time_label,'12:30–13:00');
  assert.equal(schedule.sessions[1].time_label,'21:30–22:00');
  assert.equal(schedule.walkthroughs.every(item=>item.time_label.endsWith(item.session==='MORNING'?'13:00':'22:00')),true);
});

test('manual schedules keep roster identity, reject overlap, and never cross the intermission',()=>{
  const manual=[
    {providerKey:'one',startTime:'10:00',endTime:'10:40'},
    {providerKey:'two',startTime:'17:30',endTime:'18:10'}
  ];
  const schedule=buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:manual});
  assert.deepEqual(schedule.walkthroughs.map(item=>item.provider_key),['one','two']);
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:[manual[0],{providerKey:'two',startTime:'10:30',endTime:'11:00'}]}),/FEATURED_MANUAL_SCHEDULE_OVERLAP/);
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:[manual[0],{providerKey:'two',startTime:'12:50',endTime:'17:10'}]}),/FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION/);
});

test('administrator manual intervals persist and project with public transporter handles',()=>{
  const admin=repo.findUserByEmail('admin@loadgistic.local');
  const featureDate=ethiopiaDate(4);
  const candidates=repo.listFeaturedProviderCandidates(admin,featureDate).filter(item=>item.eligible);
  assert.ok(candidates.length>=2);
  const selected=candidates.slice(0,2);
  repo.saveFeaturedProviderDay(admin,{
    featureDate,
    providerKeys:selected.map(item=>item.provider_key),
    scheduleMode:'MANUAL',
    manualSchedule:[
      {providerKey:selected[0].provider_key,startTime:'10:30',endTime:'11:10'},
      {providerKey:selected[1].provider_key,startTime:'19:20',endTime:'20:00'}
    ],
    publish:true
  });
  const adminDay=repo.getAdminFeaturedProviderDay(admin,featureDate);
  assert.equal(adminDay.schedule.mode,'MANUAL');
  assert.deepEqual(adminDay.schedule.walkthroughs.map(item=>item.time_label),['10:30–11:10','19:20–20:00']);
  const publicDay=repo.getDailyFeaturedProviders(featureDate);
  assert.equal(publicDay.schedule.mode,'MANUAL');
  assert.deepEqual(publicDay.schedule.walkthroughs.map(item=>item.provider_key),selected.map(item=>item.handle));
  assert.equal(JSON.stringify(publicDay).includes(selected[0].provider_key),false);
});

test('public read suppresses a provider immediately after required evidence is revoked',()=>{
  const db=getDb();
  const before=repo.getDailyFeaturedProviders();
  const target=before.providers.find(item=>item.provider_kind==='FLEET')||before.providers[0];
  const candidateBefore=repo.listFeaturedProviderCandidates(repo.findUserByEmail('admin@loadgistic.local'),ethiopiaDate()).find(item=>item.handle===target.handle);
  const [kind,id]=candidateBefore.provider_key.split(':');
  const subjectType=kind==='organization'?'ORGANIZATION':'PROVIDER_PROFILE';
  const verificationType=kind==='organization'?'BUSINESS_LICENSE':'IDENTITY';
  db.prepare(`UPDATE verification_requests SET status='REJECTED' WHERE subject_type=? AND subject_id=? AND verification_type=?`).run(subjectType,id,verificationType);
  const after=repo.getDailyFeaturedProviders();
  assert.equal(after.providers.some(item=>item.handle===target.handle),false);
  const admin=repo.findUserByEmail('admin@loadgistic.local');
  const candidate=repo.listFeaturedProviderCandidates(admin,ethiopiaDate()).find(item=>item.handle===target.handle);
  assert.equal(candidate.eligible,false);
  assert.ok(candidate.reasons.length>0);
});
