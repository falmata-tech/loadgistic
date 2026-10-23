import {randomUUID} from 'node:crypto';
import {localAuditService,checked,auditIdentity} from './audit-helpers';
import {regionalExpoGroupForDate} from '../../src/lib/provider-regions.js';

export async function addLocalSmokeSponsor({position=1,name='Local smoke sponsor'}:{position?:number;name?:string}={}){
  const service=localAuditService();
  const admin=await auditIdentity(service,'admin@loadgistic.local');
  const id=randomUUID(),placementId=randomUUID();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const group=regionalExpoGroupForDate(date);
  if(!group)throw new Error('LOCAL_SPONSOR_GROUP_REQUIRED');
  const cleanup=async()=>{
    let failed=false;
    try{checked(await service.from('sponsor_placements').delete().eq('id',placementId).eq('sponsor_id',id));}catch{failed=true;}
    try{checked(await service.from('sponsors').delete().eq('id',id));}catch{failed=true;}
    if(failed)throw new Error('LOCAL_SPONSOR_CLEANUP_FAILED');
  };
  try{
    checked(await service.from('sponsors').insert({id,sponsor_kind:'ADVERTISER',business_name:name,description:'Isolated sponsor for browser workflow checks.',website_url:'https://example.com',active:true,created_by:admin.id,updated_by:admin.id}));
    checked(await service.from('sponsor_placements').insert({id:placementId,sponsor_id:id,expo_group_key:group.key,starts_on:date,ends_on:date,position,active:true,created_by:admin.id,updated_by:admin.id}));
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
