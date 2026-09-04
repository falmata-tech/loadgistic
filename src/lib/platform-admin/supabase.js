import {normalizeOptionalCallbackPhone} from '../domain.js';
import {buildFeaturedDaySchedule,validateFeaturedScheduleConfig} from '../expo-broadcast.js';
import {PROVIDER_REGIONS,providerRegionLabel,regionalExpoGroupForDate} from '../provider-regions.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {featuredTruckTypeForDate} from '../featured-trucks.js';
import {loadFeaturedTruckCandidates} from '../featured-truck-candidates.js';

export const PLATFORM_PERMISSIONS=Object.freeze({
  CUSTOMERS:'CUSTOMERS',OPERATIONS:'OPERATIONS',TRUST:'TRUST',BILLING:'BILLING',SUPPORT:'SUPPORT'
});

const PERMISSION_FIELDS=Object.freeze({
  CUSTOMERS:'can_manage_customers',OPERATIONS:'can_manage_operations',TRUST:'can_manage_trust',
  BILLING:'can_manage_billing',SUPPORT:'can_manage_support'
});

const MANAGED_ERRORS=[
  'FORBIDDEN','NOT_FOUND','INVALID_ADMIN_OPERATIONS_VIEW','INVALID_ADMIN_RECORD_TYPE','INVALID_ADMIN_RECORD_COMMAND',
  'ADMIN_SELF_SUSPENSION_DENIED','SPONSORED_ACCESS_BUSINESS_ONLY','FEATURED_DATE_INVALID','FEATURED_TIKTOK_URL_INVALID',
  'FEATURED_PROVIDER_REQUIRED','FEATURED_PROVIDER_DUPLICATE','FEATURED_PROVIDER_INVALID','FEATURED_PROVIDER_INELIGIBLE',
  'FEATURED_HEADLINE_INVALID','FEATURED_INTRODUCTION_INVALID','FEATURED_SCHEDULE_MODE_INVALID',
  'FEATURED_TARGET_COUNT_INVALID','FEATURED_TARGET_COUNT_MISMATCH','FEATURED_TRUCK_THEME_INVALID',
  'FEATURED_TRUCK_INVALID','FEATURED_TRUCK_DUPLICATE','FEATURED_TRUCK_INELIGIBLE','FEATURED_DRIVER_REQUIRED',
  'SPONSORSHIP_DATE_RANGE_INVALID','SPONSORSHIP_POSITION_INVALID','SPONSORSHIP_KIND_INVALID',
  'SPONSORSHIP_PROVIDER_INVALID','SPONSORSHIP_PROVIDER_INELIGIBLE','SPONSOR_NAME_INVALID',
  'SPONSOR_DESCRIPTION_INVALID','SPONSOR_WEBSITE_INVALID','SPONSOR_CONTACT_REQUIRED','SPONSORSHIP_OVERLAP',
  'SPONSORSHIP_NOT_FOUND'
];

function managedError(fallback,error){
  const message=String(error?.message||'');
  return new Error(MANAGED_ERRORS.find(code=>message.includes(code))||fallback,{cause:error});
}

export function hasPlatformPermission(user,permission){
  if(user?.role==='ADMIN')return true;
  const field=PERMISSION_FIELDS[permission];
  return Boolean(field&&user?.role==='SUPPORT'&&user[field]);
}

function assertAdministrator(user){if(user?.role!=='ADMIN')throw new Error('FORBIDDEN');}

function validateDate(value){
  const date=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T12:00:00.000Z`)))throw new Error('FEATURED_DATE_INVALID');
  return date;
}

function validateTikTokUrl(value){
  const raw=String(value||'').trim();if(!raw)return null;
  let url;try{url=new URL(raw);}catch{throw new Error('FEATURED_TIKTOK_URL_INVALID');}
  const hostname=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||!(hostname==='tiktok.com'||hostname.endsWith('.tiktok.com')))throw new Error('FEATURED_TIKTOK_URL_INVALID');
  return url.toString();
}

function validateText(value,min,max,errorCode){
  const text=String(value||'').trim();if(!text)return null;
  if(text.length<min||text.length>max)throw new Error(errorCode);return text;
}

function validateWebsite(value){
  const raw=String(value||'').trim();if(!raw)return null;
  let url;try{url=new URL(raw);}catch{throw new Error('SPONSOR_WEBSITE_INVALID');}
  if(url.protocol!=='https:')throw new Error('SPONSOR_WEBSITE_INVALID');return url.toString();
}

function seededPortrait(filename){
  const value=String(filename||'');return /^[a-z0-9-]+\.png$/.test(value)?`/marketing/transporters/${value}`:null;
}

function providerKindLabel(value){
  if(value==='FLEET_TRANSPORTER')return 'Fleet transporter';
  if(value==='OWNER_OPERATOR')return 'Owner-operator';
  return 'Self-managed driver';
}

function candidateKey(candidate){
  return candidate.provider_organization_id?`organization:${candidate.provider_organization_id}`:`profile:${candidate.provider_profile_id}`;
}

function decorateCandidate(raw){
  const candidate=raw?.payload||raw||{};const signal=candidate.regular_signal;
  const corridor=signal?.geometry==='RADIUS'
    ?[signal.area_center_label,...(signal.area_boundary||[]).map(point=>point.label)].filter(Boolean).join(' · ')
    :(signal?.route_points||[]).map(point=>point.label).filter(Boolean).join('–');
  const provider_key=candidateKey(candidate);
  return {...candidate,provider_key,base_region:providerRegionLabel(candidate.base_region_code),
    provider_kind_label:providerKindLabel(candidate.provider_kind),
    profile_image_url:candidate.has_profile_image
      ?`/api/public/providers/${encodeURIComponent(candidate.handle)}/image?v=${encodeURIComponent(candidate.profile_image_updated_at||'1')}`
      :seededPortrait(candidate.profile_image_preset),
    corridors:corridor?[corridor]:[],reasons:candidate.eligible?[]:['Public profile or required document review is incomplete']};
}

function scheduleValue(value,fallback){
  if(value&&typeof value==='object')return value;
  try{return JSON.parse(String(value||''));}catch{return fallback;}
}

function scheduleForDay(day,featureDate,keys){
  const mode=String(day?.schedule_mode||'AUTO').toUpperCase();
  const config=scheduleValue(day?.schedule_config_json,{});
  const manualSchedule=scheduleValue(day?.manual_schedule_json,[]);
  return buildFeaturedDaySchedule(featureDate,keys,{mode,config,manualSchedule});
}

function assignSponsors(schedule,sponsors,featureDate){
  const names=sponsors.filter(item=>item.eligible&&item.starts_on<=featureDate&&item.ends_on>=featureDate)
    .map(item=>item.sponsor_name).filter(Boolean);let index=0;
  return {...schedule,entries:schedule.entries.map(entry=>{
    if(entry.type!=='PROGRAMME_BREAK'||!names.length)return entry;
    const name=names[index%names.length];index+=1;return {...entry,sponsor_name:name,label:`Sponsor · ${name}`};
  })};
}

function pageFromRows(rows,page,pageSize){
  const items=(rows||[]).map(row=>row?.payload||row);const total=Number(rows?.[0]?.total_count||0);
  return {items,total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
}

export async function getAdminOperations(user,query='',options={}){
  const view=String(options.view||'WORKSPACES').toUpperCase();
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||20));
  const page=Math.max(1,Number(options.page)||1);const search=String(query||'').trim().slice(0,80);
  const client=createSupabaseAdminClient();
  const [countsResult,pageResult]=await Promise.all([
    client.rpc('managed_admin_operation_counts',{actor_user_id:user.id}),
    client.rpc('managed_admin_operations_page',{actor_user_id:user.id,requested_view:view,search_text:search,
      requested_offset:(page-1)*pageSize,requested_limit:pageSize})
  ]);
  if(countsResult.error||pageResult.error)throw managedError('SUPABASE_ADMIN_OPERATIONS_FAILED',countsResult.error||pageResult.error);
  const pagination=pageFromRows(pageResult.data,page,pageSize);
  return {counts:countsResult.data||{},view,items:pagination.items,pagination,query:search};
}

export async function getAdminOperationRecord(user,view,id,kind=''){
  const selectedView=String(view||'').toUpperCase();
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_admin_operation_record',{
    actor_user_id:user.id,requested_view:selectedView,record_id:String(id||''),requested_kind:String(kind||'').toUpperCase()
  });
  if(error)throw managedError('SUPABASE_ADMIN_OPERATION_RECORD_FAILED',error);
  return data||null;
}

async function adminCommand(user,type,id,command){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_admin_record_command',{actor_user_id:user.id,record_type:type,record_id:id,command});
  if(error)throw managedError('SUPABASE_ADMIN_COMMAND_FAILED',error);return data;
}

export function updateFleetDriverPermissions(user,driverUserId,input){
  return adminCommand(user,'DRIVER_PERMISSIONS',driverUserId,{action:'UPDATE_PERMISSIONS',
    can_manage_capacity:Boolean(input.canManageCapacity),can_manage_tracking:Boolean(input.canManageTracking)});
}

export function setAdminRecordActive(user,recordType,recordId,active){
  return adminCommand(user,String(recordType||'').toUpperCase(),recordId,{action:'SET_ACTIVE',active:Boolean(active)});
}

export function moderateAdminRecord(user,recordType,recordId,command){
  return adminCommand(user,String(recordType||'').toUpperCase(),recordId,{action:String(command||'').toUpperCase()});
}

export function grantSponsoredBusinessAccess(user,organizationId){
  return adminCommand(user,'WORKSPACE_SPONSOR',organizationId,{action:'GRANT'});
}

export async function getAdminFeaturedProviderDay(user,date){
  assertAdministrator(user);const featureDate=validateDate(date);const expo=regionalExpoGroupForDate(featureDate);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_admin_featured_day',{actor_user_id:user.id,requested_date:featureDate,
    requested_group_key:expo.key,requested_region_codes:PROVIDER_REGIONS.map(region=>region.code)});
  if(error)throw managedError('SUPABASE_ADMIN_FEATURED_FAILED',error);
  const day=data?.day||null;const slots=data?.slots||[];const providerCandidates=(data?.candidates||[]).map(decorateCandidate);
  const candidates=await loadFeaturedTruckCandidates(client,featureDate,providerCandidates);
  const byTruck=new Map(candidates.map(candidate=>[candidate.truck_key,candidate]));
  const byProvider=new Map(providerCandidates.map(candidate=>[candidate.provider_key,candidate]));
  const slotEvaluations=slots.map(slot=>{const key=`vehicle:${slot.vehicle_id}`;const candidate=byTruck.get(key)||null;return {...slot,candidate,eligible:Boolean(candidate?.eligible&&candidate.driver_user_id===slot.driver_user_id)};});
  const sponsorships=(data?.sponsorships||[]).map(sponsorship=>{
    const provider_key=sponsorship.sponsor_kind==='TRANSPORTER'
      ?(sponsorship.provider_organization_id?`organization:${sponsorship.provider_organization_id}`:`profile:${sponsorship.provider_profile_id}`):null;
    const candidate=provider_key?byProvider.get(provider_key)||null:null;
    return {...sponsorship,provider_key,candidate,
      sponsor_name:sponsorship.sponsor_kind==='ADVERTISER'?sponsorship.business_name:candidate?.name||'Transporter unavailable',
      eligible:sponsorship.sponsor_kind==='ADVERTISER'||Boolean(candidate?.eligible)};
  });
  const slotKeys=slots.filter(slot=>slot.vehicle_id).map(slot=>`vehicle:${slot.vehicle_id}`);
  const schedule=assignSponsors(scheduleForDay(day,featureDate,slotKeys),sponsorships,featureDate);
  return {day,slots,slotEvaluations,candidates,providerCandidates,sponsorships,expo,schedule,walkthroughs:schedule.walkthroughs};
}

export async function listFeaturedProviderCandidates(user,date){
  return (await getAdminFeaturedProviderDay(user,date)).candidates;
}

export async function saveFeaturedProviderDay(user,input={}){
  assertAdministrator(user);const featureDate=validateDate(input.featureDate);const theme=featuredTruckTypeForDate(featureDate);
  const truckKeys=(Array.isArray(input.truckKeys)?input.truckKeys:[]).map(String).filter(Boolean);
  if(new Set(truckKeys).size!==truckKeys.length)throw new Error('FEATURED_TRUCK_DUPLICATE');
  const scheduleMode=String(input.scheduleMode||'AUTO').toUpperCase();
  const scheduleConfig=validateFeaturedScheduleConfig({...input.scheduleConfig,targetCount:input.targetCount});
  if(input.publish&&truckKeys.length!==scheduleConfig.targetCount)throw new Error('FEATURED_TARGET_COUNT_MISMATCH');
  let manualSchedule=input.manualSchedule;
  if(typeof manualSchedule==='string'){try{manualSchedule=JSON.parse(manualSchedule||'[]');}catch{throw new Error('FEATURED_MANUAL_SCHEDULE_INVALID');}}
  if(!Array.isArray(manualSchedule))manualSchedule=[];
  const schedule=buildFeaturedDaySchedule(featureDate,truckKeys,{mode:scheduleMode,config:scheduleConfig,manualSchedule});
  const client=createSupabaseAdminClient();const {error}=await client.rpc('save_managed_featured_truck_day',{actor_user_id:user.id,command:{
    feature_date:featureDate,theme_key:theme.key,theme_label:theme.label,theme_configurations:theme.configurations,target_count:scheduleConfig.targetCount,
    public_headline:validateText(input.publicHeadline,3,90,'FEATURED_HEADLINE_INVALID'),
    public_introduction:validateText(input.publicIntroduction,10,240,'FEATURED_INTRODUCTION_INVALID'),
    tiktok_url:validateTikTokUrl(input.tiktokUrl),schedule_mode:scheduleMode,schedule_config:schedule.config,
    manual_schedule:scheduleMode==='MANUAL'?manualSchedule:[],truck_keys:truckKeys,publish:Boolean(input.publish)
  }});
  if(error)throw managedError('SUPABASE_FEATURED_SAVE_FAILED',error);
  return getAdminFeaturedProviderDay(user,featureDate);
}

export async function saveProviderSponsorship(user,input={}){
  assertAdministrator(user);const featureDate=validateDate(input.featureDate);const startsOn=validateDate(input.startsOn);
  const endsOn=validateDate(input.endsOn);const span=(Date.parse(`${endsOn}T12:00:00Z`)-Date.parse(`${startsOn}T12:00:00Z`))/86400000;
  if(startsOn>endsOn||span>365)throw new Error('SPONSORSHIP_DATE_RANGE_INVALID');
  const position=Number(input.position);if(!Number.isInteger(position)||position<1||position>5)throw new Error('SPONSORSHIP_POSITION_INVALID');
  const sponsorKind=String(input.sponsorKind||'TRANSPORTER').toUpperCase();
  if(!['TRANSPORTER','ADVERTISER'].includes(sponsorKind))throw new Error('SPONSORSHIP_KIND_INVALID');
  const expo=regionalExpoGroupForDate(featureDate);let businessName=null,description=null,websiteUrl=null,phone=null;
  if(sponsorKind==='ADVERTISER'){
    businessName=String(input.businessName||'').trim();description=String(input.description||'').trim();
    if(businessName.length<2||businessName.length>100)throw new Error('SPONSOR_NAME_INVALID');
    if(description.length<10||description.length>240)throw new Error('SPONSOR_DESCRIPTION_INVALID');
    websiteUrl=validateWebsite(input.websiteUrl);phone=normalizeOptionalCallbackPhone(input.phone);
    if(!websiteUrl&&!phone)throw new Error('SPONSOR_CONTACT_REQUIRED');
  }
  const client=createSupabaseAdminClient();const {error}=await client.rpc('save_managed_sponsorship',{actor_user_id:user.id,command:{
    feature_date:featureDate,group_key:expo.key,region_codes:expo.regionCodes,sponsorship_id:String(input.sponsorshipId||''),
    sponsor_kind:sponsorKind,provider_key:String(input.providerKey||''),business_name:businessName,description,
    website_url:websiteUrl,phone,starts_on:startsOn,ends_on:endsOn,position
  }});
  if(error)throw managedError('SUPABASE_SPONSORSHIP_SAVE_FAILED',error);
  return getAdminFeaturedProviderDay(user,featureDate);
}

export async function disableProviderSponsorship(user,sponsorshipId){
  assertAdministrator(user);const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('disable_managed_sponsorship',{actor_user_id:user.id,sponsorship_id:String(sponsorshipId||'')});
  if(error)throw managedError('SUPABASE_SPONSORSHIP_DISABLE_FAILED',error);return data;
}
