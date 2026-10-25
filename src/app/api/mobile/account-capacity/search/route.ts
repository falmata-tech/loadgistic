import {mobileActor,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {capacityFilterParams} from '@/lib/capacity-filter-values.js';
import {searchCapacity} from '@/lib/capacity-search';
import {privateContactDigest} from '@/lib/security.js';

export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const user=await mobileActor(request);
  if(!['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role))throw new MobileError(403,'FORBIDDEN','This account cannot search shared capacity.');
  const params=new URL(request.url).searchParams;
  if(params.getAll('q').length>1||params.getAll('page').length>1)throw new MobileError(400,'INVALID_INPUT','Check your search.');
  let filters:Record<string,string>;
  try{filters={...Object.fromEntries(params),...capacityFilterParams(params)};}
  catch{throw new MobileError(400,'INVALID_INPUT','Check your search and vehicle filters.');}
  if((filters.q||'').length>120)throw new MobileError(400,'INVALID_INPUT','Search is too long.');
  return mobileJson(await searchCapacity(filters,{audience:'ACCOUNT',actorId:user.id,digest:privateContactDigest(user.email)}));
 }catch(error){return mobileFailure(error);}
}
