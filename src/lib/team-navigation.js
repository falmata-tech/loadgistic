import {adminAccountReturnPath} from './admin-account-navigation.js';
const supportViews=['ASSIGNED','WAITING','CLOSED','ALL'];
const page=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=1_000_000?String(Number(value)):'1';

// Return context is presentation only. It never grants access to a queue.
export function teamQueuePath(service,role,options={}){
  const admin=role==='ADMIN';
  if(service==='brokerage'){
    return '/app/more';
  }
  const views=admin?supportViews:supportViews.slice(0,3);
  const params=new URLSearchParams(admin?{tab:'chats'}:{});
  params.set('view',views.includes(options.view)?options.view:'ASSIGNED');
  params.set(admin?'queuePage':'page',page(options.page));
  return `${admin?'/admin/support':'/support'}?${params}`;
}

export function teamQueueReturnPath(value,service,role){
  const fallback=teamQueuePath(service,role);
  if(service==='brokerage')return fallback;
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value))return fallback;
  try{
    const url=new URL(value,'https://team.invalid'),admin=role==='ADMIN';
    const pathname=admin?'/admin/support':'/support';
    const keys=admin?['tab','view','queuePage']:['view','page'];
    if(url.origin!=='https://team.invalid'||url.pathname!==pathname||url.hash)return fallback;
    for(const key of url.searchParams.keys())if(!keys.includes(key)||url.searchParams.getAll(key).length!==1)return fallback;
    if(admin&&url.searchParams.has('tab')&&url.searchParams.get('tab')!=='chats')return fallback;
    const normalized=teamQueuePath(service,role,{queue:url.searchParams.get('queue'),view:url.searchParams.get('view'),page:url.searchParams.get(!admin?'page':'queuePage')});
    // Unknown enum/page values are rejected, rather than forwarded to another
    // queue. Omitted fields use the same explicit safe defaults as navigation.
    const parsed=new URL(normalized,'https://team.invalid');
    for(const [key,current] of url.searchParams)if(parsed.searchParams.get(key)!==current)return fallback;
    return normalized;
  }catch{return fallback;}
}

export function teamConversationHref(service,id,returnTo){
  if(service==='brokerage')throw Error('PLATFORM_BROKERAGE_RETIRED');
  if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error('INVALID_TEAM_CONVERSATION');
  return `/support/${id}?${new URLSearchParams({returnTo})}`;
}

export function supportConversationReturnPath(value,role){
  return ['ADMIN','SUPPORT'].includes(role)&&adminAccountReturnPath(value)||teamQueueReturnPath(value,'support',role);
}
