import {mobileActor,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {listAccountCapacity} from '@/lib/private-capacity.js';
import {capacityFilterParams} from '@/lib/capacity-filter-values.js';

export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const user=await mobileActor(request);
  if(!['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role))throw new MobileError(403,'FORBIDDEN','This account cannot view shared capacity.');
  const params=new URL(request.url).searchParams;
  if(params.getAll('q').length>1||params.getAll('cursor').length>1)throw new MobileError(400,'INVALID_INPUT','Check your vehicle filters.');
  let filters:Record<string,string>;
  try{filters={...Object.fromEntries(params),...capacityFilterParams(params)};}
  catch{throw new MobileError(400,'INVALID_INPUT','Check your vehicle filters.');}
  if((filters.q||'').length>120||(filters.cursor||'').length>512)throw new MobileError(400,'INVALID_INPUT','Check your vehicle filters.');
  return mobileJson(await listAccountCapacity(user,filters));
 }catch(error){return mobileFailure(error);}
}
