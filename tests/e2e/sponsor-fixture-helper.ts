import {randomUUID} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {regionalExpoGroupForDate} from '../../src/lib/provider-regions.js';

export async function addLocalSmokeSponsor(){
  const service=localAuditService();
  const admin=checked(await service.from('profiles').select('id').eq('email','admin@loadgistic.local').single());
  const id=randomUUID();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const group=regionalExpoGroupForDate(date);
  if(!group)throw new Error('LOCAL_SPONSOR_GROUP_REQUIRED');
  checked(await service.from('sponsors').insert({id,sponsor_kind:'ADVERTISER',business_name:'Local smoke sponsor',description:'Isolated sponsor for browser workflow checks.',website_url:'https://example.com',created_by:admin.id,updated_by:admin.id}));
  const cleanup=async()=>{checked(await service.from('sponsors').delete().eq('id',id));};
  try{
    checked(await service.from('sponsor_placements').insert({sponsor_id:id,expo_group_key:group.key,starts_on:date,ends_on:date,position:1,created_by:admin.id,updated_by:admin.id}));
    return cleanup;
  }catch(error){await cleanup();throw error;}
}

export async function temporarilyHideLocalSponsors(){
  const service=localAuditService();
  const rows=checked(await service.from('sponsor_placements').select('id').eq('active',true));
  const ids=rows.map((row:{id:string})=>row.id);
  if(ids.length)checked(await service.from('sponsor_placements').update({active:false}).in('id',ids));
  return async()=>{if(ids.length)checked(await service.from('sponsor_placements').update({active:true}).in('id',ids));};
}
