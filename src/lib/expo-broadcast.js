export const DEFAULT_FEATURED_SCHEDULE_CONFIG=Object.freeze({
  dayStart:'08:00',
  morningEnd:'13:00',
  eveningStart:'17:00',
  dayEnd:'22:00',
  transitionMinutes:10,
  sponsorBreakEvery:3,
  sponsorBreakMinutes:15,
  targetPresentationMinutes:30
});

const TIME_PATTERN=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const FEATURED_TIME_ZONE='Africa/Addis_Ababa';
const MINUTE=60000;

function timeToMinutes(value,errorCode='FEATURED_SCHEDULE_TIME_INVALID'){
  const time=String(value||'').trim();
  if(!TIME_PATTERN.test(time))throw new Error(errorCode);
  return Number(time.slice(0,2))*60+Number(time.slice(3));
}

function boundedInteger(value,fallback,min,max,errorCode){
  const parsed=value===''||value===null||value===undefined?fallback:Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(errorCode);
  return parsed;
}

export function validateFeaturedScheduleConfig(input={}){
  const config={
    dayStart:String(input.dayStart||DEFAULT_FEATURED_SCHEDULE_CONFIG.dayStart),
    morningEnd:String(input.morningEnd||DEFAULT_FEATURED_SCHEDULE_CONFIG.morningEnd),
    eveningStart:String(input.eveningStart||DEFAULT_FEATURED_SCHEDULE_CONFIG.eveningStart),
    dayEnd:String(input.dayEnd||DEFAULT_FEATURED_SCHEDULE_CONFIG.dayEnd),
    transitionMinutes:boundedInteger(input.transitionMinutes,DEFAULT_FEATURED_SCHEDULE_CONFIG.transitionMinutes,5,30,'FEATURED_TRANSITION_INVALID'),
    sponsorBreakEvery:boundedInteger(input.sponsorBreakEvery,DEFAULT_FEATURED_SCHEDULE_CONFIG.sponsorBreakEvery,2,6,'FEATURED_SPONSOR_BREAK_FREQUENCY_INVALID'),
    sponsorBreakMinutes:boundedInteger(input.sponsorBreakMinutes,DEFAULT_FEATURED_SCHEDULE_CONFIG.sponsorBreakMinutes,10,45,'FEATURED_SPONSOR_BREAK_DURATION_INVALID'),
    targetPresentationMinutes:boundedInteger(input.targetPresentationMinutes,DEFAULT_FEATURED_SCHEDULE_CONFIG.targetPresentationMinutes,15,60,'FEATURED_PRESENTATION_DURATION_INVALID')
  };
  const dayStart=timeToMinutes(config.dayStart);
  const morningEnd=timeToMinutes(config.morningEnd);
  const eveningStart=timeToMinutes(config.eveningStart);
  const dayEnd=timeToMinutes(config.dayEnd);
  if(dayStart<8*60||dayEnd>22*60||!(dayStart<morningEnd&&morningEnd<eveningStart&&eveningStart<dayEnd))throw new Error('FEATURED_SCHEDULE_WINDOW_INVALID');
  if(eveningStart-morningEnd!==4*60)throw new Error('FEATURED_INTERMISSION_INVALID');
  return {...config,dayStartMinutes:dayStart,morningEndMinutes:morningEnd,eveningStartMinutes:eveningStart,dayEndMinutes:dayEnd};
}

function validateDate(dateIso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso||'')))throw new Error('FEATURED_DATE_INVALID');
  return String(dateIso);
}

function dateEpoch(dateIso,time){
  const value=Date.parse(`${validateDate(dateIso)}T${time}:00+03:00`);
  if(!Number.isFinite(value))throw new Error('FEATURED_DATE_INVALID');
  return value;
}

function timeLabel(epoch){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:FEATURED_TIME_ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(epoch));
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.hour}:${values.minute}`;
}

function interval(type,label,startAt,endAt,extra={}){
  return {
    type,
    label,
    starts_at:new Date(startAt).toISOString(),
    ends_at:new Date(endAt).toISOString(),
    time_label:`${timeLabel(startAt)}–${timeLabel(endAt)}`,
    ...extra
  };
}

function providerKeys(value){
  if(Number.isSafeInteger(Number(value))&&!Array.isArray(value)){
    const count=Number(value);
    if(count<0)throw new Error('FEATURED_PROVIDER_COUNT_INVALID');
    return Array.from({length:count},(_,index)=>`slot-${index+1}`);
  }
  if(!Array.isArray(value))throw new Error('FEATURED_PROVIDER_COUNT_INVALID');
  const keys=value.map(item=>String(item||'').trim());
  if(keys.some(key=>!key)||new Set(keys).size!==keys.length)throw new Error('FEATURED_PROVIDER_DUPLICATE');
  return keys;
}

function sessionBreakMinutes(count,config){
  if(count<=1)return 0;
  const transitions=(count-1)*config.transitionMinutes;
  const sponsorBreaks=Math.floor((count-1)/config.sponsorBreakEvery)*config.sponsorBreakMinutes;
  return transitions+sponsorBreaks;
}

function autoProviderMinutes(sessionCounts,config){
  let duration=config.targetPresentationMinutes;
  const blockMinutes=[config.morningEndMinutes-config.dayStartMinutes,config.dayEndMinutes-config.eveningStartMinutes];
  sessionCounts.forEach((count,index)=>{
    if(!count)return;
    duration=Math.min(duration,Math.floor((blockMinutes[index]-sessionBreakMinutes(count,config))/count));
  });
  if(duration<5)throw new Error('FEATURED_SCHEDULE_CAPACITY_EXCEEDED');
  return duration;
}

function buildAutoSession(dateIso,key,label,keys,windowStartMinutes,windowEndMinutes,providerMinutes,config,slotOffset){
  if(!keys.length)return {session:{key,label,provider_count:0,starts_at:null,ends_at:null,time_label:'No presentations scheduled'},entries:[],walkthroughs:[]};
  const durationMinutes=keys.length*providerMinutes+sessionBreakMinutes(keys.length,config);
  const startsAt=dateEpoch(dateIso,'00:00')+(windowEndMinutes-durationMinutes)*MINUTE;
  const windowStart=dateEpoch(dateIso,'00:00')+windowStartMinutes*MINUTE;
  if(startsAt<windowStart)throw new Error('FEATURED_SCHEDULE_CAPACITY_EXCEEDED');
  let cursor=startsAt;
  const entries=[];
  const walkthroughs=[];
  keys.forEach((providerKey,index)=>{
    const endsAt=cursor+providerMinutes*MINUTE;
    const providerEntry=interval('PROVIDER','Featured transporter',cursor,endsAt,{session:key,session_label:label,provider_key:providerKey,slot:slotOffset+index+1});
    entries.push(providerEntry);
    walkthroughs.push(providerEntry);
    cursor=endsAt;
    if(index===keys.length-1)return;
    const transitionEnd=cursor+config.transitionMinutes*MINUTE;
    entries.push(interval('TRANSITION','Changeover',cursor,transitionEnd,{session:key,session_label:label}));
    cursor=transitionEnd;
    if((index+1)%config.sponsorBreakEvery===0){
      const sponsorEnd=cursor+config.sponsorBreakMinutes*MINUTE;
      entries.push(interval('SPONSOR_BREAK','Sponsor break',cursor,sponsorEnd,{session:key,session_label:label}));
      cursor=sponsorEnd;
    }
  });
  return {
    session:{key,label,provider_count:keys.length,starts_at:new Date(startsAt).toISOString(),ends_at:new Date(cursor).toISOString(),time_label:`${timeLabel(startsAt)}–${timeLabel(cursor)}`},
    entries,
    walkthroughs
  };
}

function normalizeManualSchedule(value){
  if(Array.isArray(value))return value;
  if(!value)return [];
  try{const parsed=JSON.parse(String(value));return Array.isArray(parsed)?parsed:[];}catch{throw new Error('FEATURED_MANUAL_SCHEDULE_INVALID');}
}

function buildManual(dateIso,keys,config,manualValue){
  const manual=normalizeManualSchedule(manualValue);
  if(manual.length!==keys.length)throw new Error('FEATURED_MANUAL_SCHEDULE_INCOMPLETE');
  const byKey=new Map(manual.map(item=>[String(item?.providerKey||''),item]));
  if(byKey.size!==keys.length||keys.some(key=>!byKey.has(key)))throw new Error('FEATURED_MANUAL_SCHEDULE_INCOMPLETE');
  const midnight=dateEpoch(dateIso,'00:00');
  const providerEntries=keys.map((key,index)=>{
    const item=byKey.get(key);
    const startMinutes=timeToMinutes(item.startTime,'FEATURED_MANUAL_SCHEDULE_INVALID');
    const endMinutes=timeToMinutes(item.endTime,'FEATURED_MANUAL_SCHEDULE_INVALID');
    if(endMinutes<=startMinutes)throw new Error('FEATURED_MANUAL_SCHEDULE_INVALID');
    let session;
    let sessionLabel;
    if(startMinutes>=config.dayStartMinutes&&endMinutes<=config.morningEndMinutes){session='MORNING';sessionLabel='Morning session';}
    else if(startMinutes>=config.eveningStartMinutes&&endMinutes<=config.dayEndMinutes){session='EVENING';sessionLabel='Evening session';}
    else throw new Error('FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION');
    return interval('PROVIDER','Featured transporter',midnight+startMinutes*MINUTE,midnight+endMinutes*MINUTE,{session,session_label:sessionLabel,provider_key:key,slot:index+1});
  });
  for(let index=1;index<providerEntries.length;index++){
    if(Date.parse(providerEntries[index].starts_at)<Date.parse(providerEntries[index-1].ends_at))throw new Error('FEATURED_MANUAL_SCHEDULE_OVERLAP');
  }
  const entries=[];
  const sessions=[];
  for(const [sessionKey,sessionLabel] of [['MORNING','Morning session'],['EVENING','Evening session']]){
    const sessionProviders=providerEntries.filter(item=>item.session===sessionKey);
    sessionProviders.forEach((entry,index)=>{
      entries.push(entry);
      const next=sessionProviders[index+1];
      if(!next)return;
      const gapStart=Date.parse(entry.ends_at);
      const gapEnd=Date.parse(next.starts_at);
      if(gapEnd<=gapStart)return;
      const sponsor=(index+1)%config.sponsorBreakEvery===0;
      entries.push(interval(sponsor?'SPONSOR_BREAK':'TRANSITION',sponsor?'Sponsor break':'Changeover',gapStart,gapEnd,{session:sessionKey,session_label:sessionLabel}));
    });
    sessions.push(sessionProviders.length?{key:sessionKey,label:sessionLabel,provider_count:sessionProviders.length,starts_at:sessionProviders[0].starts_at,ends_at:sessionProviders.at(-1).ends_at,time_label:`${timeLabel(Date.parse(sessionProviders[0].starts_at))}–${timeLabel(Date.parse(sessionProviders.at(-1).ends_at))}`}:{key:sessionKey,label:sessionLabel,provider_count:0,starts_at:null,ends_at:null,time_label:'No presentations scheduled'});
  }
  return {sessions,entries,walkthroughs:providerEntries};
}

export function buildFeaturedDaySchedule(dateIso,providers,options={},now=Date.now()){
  const date=validateDate(dateIso);
  const keys=providerKeys(providers);
  const mode=String(options.mode||'AUTO').toUpperCase();
  if(!['AUTO','MANUAL'].includes(mode))throw new Error('FEATURED_SCHEDULE_MODE_INVALID');
  const config=validateFeaturedScheduleConfig(options.config||{});
  let built;
  if(mode==='MANUAL')built=buildManual(date,keys,config,options.manualSchedule);
  else{
    const morningCount=Math.ceil(keys.length/2);
    const sessionCounts=[morningCount,keys.length-morningCount];
    const presentationMinutes=keys.length?autoProviderMinutes(sessionCounts,config):config.targetPresentationMinutes;
    const morning=buildAutoSession(date,'MORNING','Morning session',keys.slice(0,morningCount),config.dayStartMinutes,config.morningEndMinutes,presentationMinutes,config,0);
    const evening=buildAutoSession(date,'EVENING','Evening session',keys.slice(morningCount),config.eveningStartMinutes,config.dayEndMinutes,presentationMinutes,config,morningCount);
    built={sessions:[morning.session,evening.session],entries:[...morning.entries,...evening.entries],walkthroughs:[...morning.walkthroughs,...evening.walkthroughs]};
  }
  const intermission=interval('INTERMISSION','Midday intermission',dateEpoch(date,config.morningEnd),dateEpoch(date,config.eveningStart));
  const entries=[...built.entries,intermission].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  const value=now instanceof Date?now.getTime():Number(now);
  const activeEntry=entries.find(entry=>value>=Date.parse(entry.starts_at)&&value<Date.parse(entry.ends_at))||null;
  const walkthroughs=built.walkthroughs.map(item=>({...item,label:item.time_label,current:activeEntry?.type==='PROVIDER'&&activeEntry.provider_key===item.provider_key}));
  const first=walkthroughs.length?Math.min(...walkthroughs.map(item=>Date.parse(item.starts_at))):dateEpoch(date,config.dayStart);
  const last=walkthroughs.length?Math.max(...walkthroughs.map(item=>Date.parse(item.ends_at))):dateEpoch(date,config.dayEnd);
  let phase='scheduled';
  if(value>=last)phase='ended';
  else if(activeEntry?.type==='INTERMISSION')phase='intermission';
  else if(activeEntry?.session==='MORNING')phase='morning';
  else if(activeEntry?.session==='EVENING')phase='evening';
  else if(value>=first)phase='between';
  const sessionLabels=built.sessions.filter(session=>session.provider_count).map(session=>`${session.label.replace(' session','')} ${session.time_label}`);
  return {
    mode,
    config:{
      dayStart:config.dayStart,
      morningEnd:config.morningEnd,
      eveningStart:config.eveningStart,
      dayEnd:config.dayEnd,
      transitionMinutes:config.transitionMinutes,
      sponsorBreakEvery:config.sponsorBreakEvery,
      sponsorBreakMinutes:config.sponsorBreakMinutes,
      targetPresentationMinutes:config.targetPresentationMinutes
    },
    sessions:built.sessions,
    entries,
    walkthroughs,
    intermission,
    active_entry:activeEntry,
    phase,
    display_label:sessionLabels.join(' · ')||'Schedule pending'
  };
}
