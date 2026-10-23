const reviewStates=['ALL','PENDING','MORE_INFO','APPROVED','REJECTED'];
const ratingStates=['PENDING','UPHELD','REMOVED'];

export function reviewQueueStatus(tab,value){
  const choices=tab==='ratings'?ratingStates:reviewStates;
  const status=String(value||'').toUpperCase();
  return choices.includes(status)?status:choices[0];
}

export function reviewQueuePath(tab,options={}){
  const selected=['documents','payments','ratings'].includes(tab)?tab:'documents';
  const params=new URLSearchParams({tab:selected,status:reviewQueueStatus(selected,options.status)});
  const query=String(options.q||'').trim().slice(0,120);
  if(query&&selected!=='ratings')params.set('q',query);
  const requested=Number(options.page);
  params.set('page',String(Number.isSafeInteger(requested)&&requested>0&&requested<=1_000_000?requested:1));
  return `/admin/reviews?${params}`;
}

export function reviewQueueReturnPath(value,tab){
  const fallback=reviewQueuePath(tab);
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return fallback;
  try{
    const url=new URL(value,'https://review.invalid');
    if(url.origin!=='https://review.invalid'||url.pathname!=='/admin/reviews'||url.searchParams.get('tab')!==tab)return fallback;
    return reviewQueuePath(tab,{status:url.searchParams.get('status'),q:url.searchParams.get('q'),page:url.searchParams.get('page')});
  }catch{return fallback;}
}
