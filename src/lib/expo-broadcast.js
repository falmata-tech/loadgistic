export const DEFAULT_FEATURED_SCHEDULE_CONFIG=Object.freeze({
  dayStart:'07:30',
  dayEnd:'09:00',
  targetCount:8,
  sponsorBreakEvery:2,
  sponsorBreakMinutes:2
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
    dayEnd:String(input.dayEnd||DEFAULT_FEATURED_SCHEDULE_CONFIG.dayEnd),
    targetCount:boundedInteger(input.targetCount,DEFAULT_FEATURED_SCHEDULE_CONFIG.targetCount,1,12,'FEATURED_TARGET_COUNT_INVALID'),
    sponsorBreakEvery:boundedInteger(input.sponsorBreakEvery,DEFAULT_FEATURED_SCHEDULE_CONFIG.sponsorBreakEvery,2,4,'FEATURED_SPONSOR_BREAK_FREQUENCY_INVALID'),
    sponsorBreakMinutes:boundedInteger(input.sponsorBreakMinutes,DEFAULT_FEATURED_SCHEDULE_CONFIG.sponsorBreakMinutes,1,2,'FEATURED_SPONSOR_BREAK_DURATION_INVALID')
  };
  const dayStartMinutes=timeToMinutes(config.dayStart);
  const dayEndMinutes=timeToMinutes(config.dayEnd);
  if(config.dayStart!=='07:30'||config.dayEnd!=='09:00'||dayEndMinutes-dayStartMinutes!==90)throw new Error('FEATURED_SCHEDULE_WINDOW_INVALID');
  return {...config,dayStartMinutes,dayEndMinutes};
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
  return {type,label,starts_at:new Date(startAt).toISOString(),ends_at:new Date(endAt).toISOString(),time_label:`${timeLabel(startAt)}–${timeLabel(endAt)}`,...extra};
}

function featuredKeys(value){
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

function scheduledBreakCount(count,config){
  return Math.min(4,Math.floor(Math.max(0,count-1)/config.sponsorBreakEvery));
}

function buildAutomatic(date,keys,config){
  if(!keys.length)return {entries:[],walkthroughs:[],sessions:[{key:'MORNING',label:'Morning programme',provider_count:0,starts_at:null,ends_at:null,time_label:'07:30–09:00'}]};
  const breakCount=scheduledBreakCount(keys.length,config);
  const presentationMinutes=config.dayEndMinutes-config.dayStartMinutes-breakCount*config.sponsorBreakMinutes;
  if(presentationMinutes<keys.length*3)throw new Error('FEATURED_SCHEDULE_CAPACITY_EXCEEDED');
  const baseMinutes=Math.floor(presentationMinutes/keys.length);
  let remainder=presentationMinutes%keys.length;
  let usedBreaks=0;
  let cursor=dateEpoch(date,config.dayStart);
  const entries=[];
  const walkthroughs=[];
  keys.forEach((key,index)=>{
    const duration=baseMinutes+(remainder>0?1:0);if(remainder>0)remainder-=1;
    const end=cursor+duration*MINUTE;
    const item=interval('PROVIDER','Featured truck',cursor,end,{session:'MORNING',session_label:'Morning programme',provider_key:key,slot:index+1});
    entries.push(item);walkthroughs.push(item);cursor=end;
    const shouldBreak=index<keys.length-1&&(index+1)%config.sponsorBreakEvery===0&&usedBreaks<4;
    if(shouldBreak){const breakEnd=cursor+config.sponsorBreakMinutes*MINUTE;entries.push(interval('PROGRAMME_BREAK','Programme pause',cursor,breakEnd,{session:'MORNING',session_label:'Morning programme'}));cursor=breakEnd;usedBreaks+=1;}
  });
  return {entries,walkthroughs,sessions:[{key:'MORNING',label:'Morning programme',provider_count:keys.length,starts_at:new Date(dateEpoch(date,config.dayStart)).toISOString(),ends_at:new Date(cursor).toISOString(),time_label:'07:30–09:00'}]};
}

function normalizeManualSchedule(value){
  if(Array.isArray(value))return value;
  if(!value)return [];
  try{const parsed=JSON.parse(String(value));return Array.isArray(parsed)?parsed:[];}catch{throw new Error('FEATURED_MANUAL_SCHEDULE_INVALID');}
}

function buildManual(date,keys,config,manualValue){
  const manual=normalizeManualSchedule(manualValue);
  if(manual.length!==keys.length)throw new Error('FEATURED_MANUAL_SCHEDULE_INCOMPLETE');
  const byKey=new Map(manual.map(item=>[String(item?.providerKey||''),item]));
  if(byKey.size!==keys.length||keys.some(key=>!byKey.has(key)))throw new Error('FEATURED_MANUAL_SCHEDULE_INCOMPLETE');
  const midnight=dateEpoch(date,'00:00');
  const walkthroughs=keys.map((key,index)=>{
    const item=byKey.get(key);const start=timeToMinutes(item.startTime,'FEATURED_MANUAL_SCHEDULE_INVALID');const end=timeToMinutes(item.endTime,'FEATURED_MANUAL_SCHEDULE_INVALID');
    if(end<=start)throw new Error('FEATURED_MANUAL_SCHEDULE_INVALID');
    if(start<config.dayStartMinutes||end>config.dayEndMinutes)throw new Error('FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION');
    return interval('PROVIDER','Featured truck',midnight+start*MINUTE,midnight+end*MINUTE,{session:'MORNING',session_label:'Morning programme',provider_key:key,slot:index+1});
  });
  const entries=[];let breakCount=0;
  walkthroughs.forEach((item,index)=>{
    if(index&&Date.parse(item.starts_at)<Date.parse(walkthroughs[index-1].ends_at))throw new Error('FEATURED_MANUAL_SCHEDULE_OVERLAP');
    if(index&&Date.parse(item.starts_at)>Date.parse(walkthroughs[index-1].ends_at)){
      breakCount+=1;if(breakCount>4||Date.parse(item.starts_at)-Date.parse(walkthroughs[index-1].ends_at)>2*MINUTE)throw new Error('FEATURED_MANUAL_BREAK_INVALID');
      entries.push(interval('PROGRAMME_BREAK','Programme pause',Date.parse(walkthroughs[index-1].ends_at),Date.parse(item.starts_at),{session:'MORNING',session_label:'Morning programme'}));
    }
    entries.push(item);
  });
  return {entries,walkthroughs,sessions:[{key:'MORNING',label:'Morning programme',provider_count:keys.length,starts_at:walkthroughs[0]?.starts_at||null,ends_at:walkthroughs.at(-1)?.ends_at||null,time_label:'07:30–09:00'}]};
}

export function buildFeaturedDaySchedule(dateIso,providers,options={},now=Date.now()){
  const date=validateDate(dateIso);const keys=featuredKeys(providers);const mode=String(options.mode||'AUTO').toUpperCase();
  if(!['AUTO','MANUAL'].includes(mode))throw new Error('FEATURED_SCHEDULE_MODE_INVALID');
  const config=validateFeaturedScheduleConfig(options.config||{});
  const built=mode==='MANUAL'?buildManual(date,keys,config,options.manualSchedule):buildAutomatic(date,keys,config);
  const value=now instanceof Date?now.getTime():Number(now);
  const activeEntry=built.entries.find(entry=>value>=Date.parse(entry.starts_at)&&value<Date.parse(entry.ends_at))||null;
  const walkthroughs=built.walkthroughs.map(item=>({...item,label:item.time_label,current:activeEntry?.type==='PROVIDER'&&activeEntry.provider_key===item.provider_key}));
  const startsAt=dateEpoch(date,config.dayStart),endsAt=dateEpoch(date,config.dayEnd);
  const phase=value<startsAt?'scheduled':value>=endsAt?'ended':activeEntry?.type==='PROVIDER'?'live':'break';
  return {mode,config:{dayStart:config.dayStart,dayEnd:config.dayEnd,targetCount:config.targetCount,sponsorBreakEvery:config.sponsorBreakEvery,sponsorBreakMinutes:config.sponsorBreakMinutes},sessions:built.sessions,entries:built.entries,walkthroughs,intermission:null,active_entry:activeEntry,phase,display_label:'07:30–09:00'};
}
