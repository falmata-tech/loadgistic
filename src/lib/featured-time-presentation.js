const ethiopiaClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Addis_Ababa',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const clockPattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const zonedIsoPattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

/** Display only. The schedule, API and editor keep their canonical 24-hour values. */
export function featuredClock(value){
 if(typeof value!=='string')return '';
 let clock=value;
 if(zonedIsoPattern.test(value)){
  const instant=Date.parse(value);if(!Number.isFinite(instant))return '';
  const parts=Object.fromEntries(ethiopiaClock.formatToParts(new Date(instant)).map(part=>[part.type,part.value]));
  clock=`${parts.hour}:${parts.minute}`;
 }
 if(clock==='24:00')clock='00:00';
 if(!clockPattern.test(clock))return '';
 const hour=Number(clock.slice(0,2)),minute=clock.slice(3);
 return `${hour%12||12}:${minute}${hour<12?'AM':'PM'}`;
}

export function featuredRange(start,end){
 const first=featuredClock(start),last=featuredClock(end);
 return first&&last?`${first}–${last} EAT`:'';
}

export function featuredRangeLabel(value){
 if(typeof value!=='string')return '';
 const match=/^((?:[01]\d|2[0-4]):[0-5]\d)–((?:[01]\d|2[0-4]):[0-5]\d)(?: EAT)?$/.exec(value);
 return match?featuredRange(match[1],match[2]):'';
}
