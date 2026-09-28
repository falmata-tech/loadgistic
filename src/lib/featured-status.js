// Pure presentation rules; dates and counters come from the private database overview.
export function featuredRunState(mode,run,now=Date.now()){
 if(mode!=='AUTO')return 'PAUSED';
 if(!run?.checked_at)return 'NOT_RUN';
 if(run.outcome==='FAILED')return 'FAILED';
 const checked=Date.parse(run.checked_at);
 if(!Number.isFinite(checked)||checked>now+60000||now-checked>45*60000||run.outcome!=='READY')return 'STALE';
 return 'READY';
}
export function featuredDayState(day,remaining){
 if(day.status==='DRAFT')return 'DRAFT';
 if(day.status==='PUBLISHED')return day.invalid>0||day.selected===0?'NEEDS_REVIEW':'PUBLISHED';
 if(day.eligible===0)return 'NO_ELIGIBLE';
 if(day.remaining===0&&remaining>0)return 'ROUND_WAIT';
 return 'NOT_PREPARED';
}
