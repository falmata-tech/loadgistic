const id='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const accountPath=new RegExp(`^/admin/operations/users/${id}$`,'i');
/** Presentation return only. The destination independently repeats Customers authority. */
export function adminAccountReturnPath(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return null;
 try{
  const url=new URL(value,'https://account.invalid');
  if(url.origin!=='https://account.invalid'||!accountPath.test(url.pathname)||url.hash)return null;
  for(const key of url.searchParams.keys())if(key!=='provider'||url.searchParams.getAll(key).length!==1)return null;
  const provider=url.searchParams.get('provider');
  if(provider&&!new RegExp(`^(ORGANIZATION|PROVIDER_PROFILE):${id}$`,'i').test(provider))return null;
  return url.pathname+(provider?'?'+new URLSearchParams({provider}).toString():'');
 }catch{return null;}
}

/** A bounded record/list return, optionally retaining one exact account context.
 * It grants no access: each destination and command authorizes independently. */
export function adminOperationReturnPath(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value))return null;
 try{
  const url=new URL(value,'https://account.invalid');
  if(url.origin!=='https://account.invalid'||url.hash)return null;
  if(accountPath.test(url.pathname))return adminAccountReturnPath(value);
  if(url.pathname==='/admin/operations'){
   const params=new URLSearchParams();
   for(const [key,current] of url.searchParams){
    if(url.searchParams.getAll(key).length!==1)return null;
    if(key==='view'&&!['USERS','WORKSPACES','TRUCKS','DRIVERS','TRACKING','CAPACITY','ROUTES'].includes(current))return null;
    else if(key==='page'&&!/^[1-9][0-9]{0,5}$/.test(current))return null;
    else if(key==='q'&&current.length>120)return null;
    else if(!['view','page','q'].includes(key))return null;
    params.set(key,current);
   }
   return url.pathname+(params.size?'?'+params:'');
  }
  const match=new RegExp(`^/admin/operations/(workspaces|trucks|drivers|tracking|capacity|routes)/${id}$`,'i').exec(url.pathname);
  if(!match)return null;
  const params=new URLSearchParams();
  for(const [key,current] of url.searchParams){
   if(url.searchParams.getAll(key).length!==1)return null;
   if(key==='kind'&&['ORGANIZATION','PROVIDER_PROFILE','CAPACITY_ROUTE','REGULAR_ROUTE'].includes(current))params.set(key,current);
   else if(key==='returnTo'){const account=adminAccountReturnPath(current);if(!account)return null;params.set(key,account);}
   else return null;
  }
  return url.pathname+(params.size?'?'+params:'');
 }catch{return null;}
}
