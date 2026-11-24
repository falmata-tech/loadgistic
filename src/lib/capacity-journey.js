// FEAT-CAP-001. Capacity journeys use Ethiopia time when a form supplies no offset.
const timestamp=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/;
const invalid=()=>{throw new Error('INVALID_CAPACITY_JOURNEY_TIME');};

/** @param {unknown} value */
export function capacityJourneyTime(value){
  if(value===undefined||value===null||value==='')return '';
  if(typeof value!=='string'||value.length>32)return invalid();
  const input=value.trim().replace(' ','T');
  const parts=timestamp.exec(input);
  if(!parts)return invalid();
  const [,date,hour,minute,second='0',offset]=parts;
  const day=new Date(date+'T00:00:00.000Z');
  if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==date||date.startsWith('0000')||
    Number(hour)>23||Number(minute)>59||Number(second)>59)return invalid();
  if(offset&&offset!=='Z'){
    const offsetHour=Number(offset.slice(1,3)),offsetMinute=Number(offset.slice(4));
    if(offsetHour>14||offsetMinute>59||offsetHour===14&&offsetMinute!==0)return invalid();
  }
  const time=new Date(offset?input:input+'+03:00');
  if(!Number.isFinite(time.getTime())||time.getUTCFullYear()<1||time.getUTCFullYear()>9999)return invalid();
  return time.toISOString();
}

/** @param {unknown} from @param {unknown} to */
export function capacityJourneyWindow(from,to){
  const start=capacityJourneyTime(from),end=capacityJourneyTime(to);
  if(start&&end&&Date.parse(start)>Date.parse(end))throw new Error('INVALID_CAPACITY_JOURNEY_RANGE');
  return {start,end};
}

/** @param {unknown} value */
export function capacityJourneyInput(value){
  let saved;
  try{saved=capacityJourneyTime(value);}catch{return '';}
  if(!saved)return '';
  const inEthiopia=new Date(Date.parse(saved)+3*3600_000);
  return inEthiopia.getUTCFullYear()<=9999?inEthiopia.toISOString().slice(0,16):'';
}
