const dayMs = 86_400_000;
const formatters = new Map();
function formatter(locale, options) {
  const key = JSON.stringify([locale,options]);
  if (!formatters.has(key)) formatters.set(key,new Intl.DateTimeFormat(locale,{calendar:'gregory',timeZone:'UTC',...options}));
  return formatters.get(key);
}
export function dateOnly(value) {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date=new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value ? date : null;
}
export function todayDate(now=new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function shiftDate(value, days) {
  const date=dateOnly(value);if(!date || !Number.isInteger(days)) throw Error('INVALID_DATE');
  return new Date(date.getTime()+days*dayMs).toISOString().slice(0,10);
}
function monthDate(year,month,day){const date=new Date('2000-01-01T12:00:00.000Z');date.setUTCFullYear(year,month,day);return date;}
export function calendarDates(value, view='week') {
  const date=dateOnly(value);if(!date) throw Error('INVALID_DATE');
  const monthStart=`${value.slice(0,7)}-01`;
  const anchor=view==='month'?monthStart:value;
  const anchorDate=dateOnly(anchor);
  const start=shiftDate(anchor,-((anchorDate.getUTCDay()+6)%7));
  const days=view==='month'?Math.ceil((((dateOnly(monthStart).getUTCDay()+6)%7)+monthDate(date.getUTCFullYear(),date.getUTCMonth()+1,0).getUTCDate())/7)*7:7;
  return Array.from({length:days},(_,index)=>shiftDate(start,index));
}
export function shiftCalendar(value,view,direction) {
  if(![-1,1].includes(direction)||!dateOnly(value)) throw Error('INVALID_DATE');
  if(view!=='month')return shiftDate(value,7*direction);
  const date=dateOnly(value);
  return monthDate(date.getUTCFullYear(),date.getUTCMonth()+direction,1).toISOString().slice(0,10);
}
export function dateAllowed(value,min='',max='') {
  return Boolean(dateOnly(value))&&(!min||value>=min)&&(!max||value<=max);
}
let ethiopic;
export function ethiopianDate(value,locale='en') {
  const date=dateOnly(value);if(!date)return null;
  try {
    if(ethiopic===undefined){
      const test=new Intl.DateTimeFormat('en',{calendar:'ethiopic',timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
      const parts=Object.fromEntries(test.formatToParts(dateOnly('2023-09-12')).map(part=>[part.type,part.value]));
      ethiopic=test.resolvedOptions().calendar==='ethiopic'&&parts.year==='2016'&&parts.month==='1'&&parts.day==='1';
    }
    if(!ethiopic)return null;
    const parts=formatter(locale,{calendar:'ethiopic',year:'numeric',month:'short',day:'numeric'}).formatToParts(date);
    const get=type=>parts.find(part=>part.type===type)?.value||'';
    return {day:get('day'),month:get('month'),year:get('year'),label:parts.map(part=>part.value).join('')};
  }catch{return null;}
}
export function calendarDay(value,locale='en') {
  const date=dateOnly(value);if(!date)throw Error('INVALID_DATE');
  return {weekday:formatter(locale,{weekday:'short'}).format(date),day:formatter(locale,{day:'numeric'}).format(date),
    label:formatter(locale,{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(date),ethiopian:ethiopianDate(value,locale)};
}
export function calendarPeriod(value,view,locale='en') {
  const dates=calendarDates(value,view);
  if(view==='month')return formatter(locale,{month:'long',year:'numeric'}).format(dateOnly(value));
  const format=formatter(locale,{month:'short',day:'numeric',year:'numeric'});
  return `${format.format(dateOnly(dates[0]))} – ${format.format(dateOnly(dates[6]))}`;
}
