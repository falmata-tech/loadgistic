import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {regionalExpoGroupForDate} from '../src/lib/provider-regions.js';
import {getAdminFeaturedProviderDay,saveFeaturedProviderDay} from '../src/lib/platform-admin/supabase.js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_PLATFORM_ADMIN_VERIFY_CONFIG_MISSING');
if(!new Set(['127.0.0.1','localhost','::1']).has(new URL(url).hostname))throw new Error('REMOTE_PLATFORM_ADMIN_VERIFY_REFUSED');
const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});

async function createIdentity(email){
  const {data,error}=await service.auth.admin.createUser({email,password:crypto.randomBytes(24).toString('base64url'),email_confirm:true});
  if(error||!data.user)throw new Error('PLATFORM_ADMIN_VERIFY_IDENTITY_CREATE_FAILED');return data.user.id;
}

async function expectError(call,code){
  const {error}=await call();if(!error||!String(error.message).includes(code))throw new Error(`EXPECTED_PLATFORM_ADMIN_REJECTION_MISSING:${code}`);
}

const suffix=crypto.randomUUID().slice(0,12);const startedAt=new Date().toISOString();
const customerEmail=`admin-customer-${suffix}@loadgistic.local`;const driverEmail=`admin-driver-${suffix}@loadgistic.local`;
const supportEmail=`admin-support-${suffix}@loadgistic.local`;const organizationId=crypto.randomUUID();
const vehicleId=crypto.randomUUID();const routeId=crypto.randomUUID();const subscriptionId=crypto.randomUUID();
let customerId;let driverId;let supportId;let featuredDate;let featuredDayId;let placementId;let sponsorId;
try{
  const {data:admin,error:adminError}=await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).maybeSingle();
  if(adminError||!admin)throw new Error('PLATFORM_ADMIN_VERIFY_ADMIN_MISSING');
  const {data:plan,error:planError}=await service.from('plans').select('id').eq('audience','BUSINESS').eq('active',true).limit(1).maybeSingle();
  if(planError||!plan)throw new Error('PLATFORM_ADMIN_VERIFY_PLAN_MISSING');
  customerId=await createIdentity(customerEmail);driverId=await createIdentity(driverEmail);supportId=await createIdentity(supportEmail);
  for(const [table,rows] of [
    ['profiles',[
      {id:customerId,email:customerEmail,full_name:'Managed Admin Customer',role:'SHIPPER',active:true},
      {id:driverId,email:driverEmail,full_name:'Managed Admin Driver',role:'DRIVER',active:true},
      {id:supportId,email:supportEmail,full_name:'Managed Customer Manager',role:'SUPPORT',active:true}
    ]],
    ['organizations',[{id:organizationId,name:'Managed Admin Test Business',handle:`managed-admin-${suffix}`,type:'ENTERPRISE_SHIPPER',city:'Addis Ababa'}]],
    ['organization_members',[{id:crypto.randomUUID(),user_id:customerId,organization_id:organizationId,membership_role:'OWNER'}]],
    ['drivers',[{id:crypto.randomUUID(),organization_id:organizationId,user_id:driverId,name:'Managed Admin Driver',active:true}]],
    ['support_agent_profiles',[{user_id:supportId,active:true,available:false,max_open_conversations:3,
      can_manage_customers:true,can_manage_operations:false,can_manage_trust:false,can_manage_billing:false,can_manage_support:false}]],
    ['vehicles',[{id:vehicleId,organization_id:organizationId,label:'Managed verifier truck',category:'LIGHT_TRUCK',
      make:'Isuzu',model:'NPR',cargo_configuration:'Light stake body truck',platform_number:`LG-VERIFY-${suffix}`,active:true}]],
    ['profile_routes',[{id:routeId,organization_id:organizationId,origin:'Addis Ababa, Ethiopia',destination:'Bishoftu, Ethiopia',
      created_by:customerId,geometry:'ROUTE',route_points_json:[
        {place_ref:'builtin:addis ababa',label:'Addis Ababa, Ethiopia',lat:9.03,lng:38.74},
        {place_ref:'builtin:bishoftu',label:'Bishoftu, Ethiopia',lat:8.75,lng:38.99}
      ]}]],
    ['subscriptions',[{id:subscriptionId,organization_id:organizationId,plan_id:plan.id,status:'TRIAL',billing_model:'FLAT_MONTHLY',
      starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+7*86400000).toISOString()}]]
  ]){
    const operation=table==='profiles'?service.from(table).upsert(rows,{onConflict:'id'}):service.from(table).insert(rows);
    const {error}=await operation;if(error)throw new Error(`PLATFORM_ADMIN_VERIFY_FIXTURE_${table.toUpperCase()}_FAILED:${error.message}`);
  }

  const forbiddenProjectionKeys=['storage_path','code_hash','tracking_token','location_lat','location_lng','password'];
  for(const view of ['USERS','WORKSPACES','TRUCKS','DRIVERS','TRACKING','CAPACITY','ROUTES','SUBSCRIPTIONS']){
    const {data,error}=await service.rpc('managed_admin_operations_page',{actor_user_id:admin.id,requested_view:view,search_text:'',requested_offset:0,requested_limit:2});
    if(error||data.length>2)throw new Error(`PLATFORM_ADMIN_VERIFY_VIEW_FAILED:${view}:${error?.message||'UNBOUNDED'}`);
    const serialized=JSON.stringify(data);for(const key of forbiddenProjectionKeys)if(serialized.includes(`\"${key}\"`))throw new Error(`PLATFORM_ADMIN_PRIVATE_FIELD_EXPOSED:${view}:${key}`);
  }
  for(const [view,id,kind] of [
    ['USERS',customerId,''],['WORKSPACES',organizationId,'ORGANIZATION'],['TRUCKS',vehicleId,''],
    ['DRIVERS',driverId,''],['ROUTES',routeId,'PROFILE_ROUTE'],['SUBSCRIPTIONS',subscriptionId,'']
  ]){
    const {data,error}=await service.rpc('managed_admin_operation_record',{
      actor_user_id:admin.id,requested_view:view,record_id:id,requested_kind:kind
    });
    if(error||!data?.id||data.id!==id)throw new Error(`PLATFORM_ADMIN_VERIFY_DETAIL_FAILED:${view}:${error?.message||'EMPTY'}`);
    const serialized=JSON.stringify(data);for(const key of forbiddenProjectionKeys)if(serialized.includes(`\"${key}\"`))throw new Error(`PLATFORM_ADMIN_DETAIL_PRIVATE_FIELD_EXPOSED:${view}:${key}`);
  }
  const {error:customerViewError}=await service.rpc('managed_admin_operations_page',{actor_user_id:supportId,requested_view:'WORKSPACES',search_text:'Managed Admin',requested_offset:0,requested_limit:5});
  if(customerViewError)throw new Error(`PLATFORM_ADMIN_DELEGATED_CUSTOMER_DENIED:${customerViewError.message}`);
  await expectError(()=>service.rpc('managed_admin_operations_page',{actor_user_id:supportId,requested_view:'TRUCKS',search_text:'',requested_offset:0,requested_limit:5}),'FORBIDDEN');
  await expectError(()=>service.rpc('managed_admin_operations_page',{actor_user_id:customerId,requested_view:'WORKSPACES',search_text:'',requested_offset:0,requested_limit:5}),'FORBIDDEN');

  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'USER',record_id:customerId,command:{action:'SET_ACTIVE',active:false}}).then(({error})=>{if(error)throw error;});
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'USER',record_id:customerId,command:{action:'SET_ACTIVE',active:true}}).then(({error})=>{if(error)throw error;});
  await expectError(()=>service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'USER',record_id:admin.id,command:{action:'SET_ACTIVE',active:false}}),'ADMIN_SELF_SUSPENSION_DENIED');
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'VEHICLE',record_id:vehicleId,command:{action:'SET_ACTIVE',active:false}}).then(({error})=>{if(error)throw error;});
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'VEHICLE',record_id:vehicleId,command:{action:'SET_ACTIVE',active:true}}).then(({error})=>{if(error)throw error;});
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'DRIVER_PERMISSIONS',record_id:driverId,
    command:{action:'UPDATE_PERMISSIONS',can_manage_capacity:true,can_manage_tracking:false}}).then(({error})=>{if(error)throw error;});
  const {data:permission,error:permissionError}=await service.from('driver_permissions').select('can_manage_capacity,can_manage_tracking').eq('user_id',driverId).single();
  if(permissionError||!permission.can_manage_capacity||permission.can_manage_tracking)throw new Error('PLATFORM_ADMIN_DRIVER_PERMISSION_NOT_PERSISTED');
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'PROFILE_ROUTE',record_id:routeId,command:{action:'REMOVE'}}).then(({error})=>{if(error)throw error;});
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'SUBSCRIPTION',record_id:subscriptionId,command:{action:'PAID'}}).then(({error})=>{if(error)throw error;});
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'SUBSCRIPTION',record_id:subscriptionId,command:{action:'EXPIRE'}}).then(({error})=>{if(error)throw error;});
  await service.rpc('managed_admin_record_command',{actor_user_id:admin.id,record_type:'WORKSPACE_SPONSOR',record_id:organizationId,command:{action:'GRANT'}}).then(({error})=>{if(error)throw error;});

  const adminUser={id:admin.id,role:'ADMIN'};
  for(let offset=0;offset<7&&!featuredDate;offset++){
    const date=new Date(Date.UTC(2035,0,1+offset)).toISOString().slice(0,10);const group=regionalExpoGroupForDate(date);
    const state=await getAdminFeaturedProviderDay(adminUser,date);const eligible=state.candidates.filter(candidate=>candidate.eligible);
    if(eligible.length)featuredDate={date,group,candidate:eligible[0]};
  }
  if(!featuredDate)throw new Error('PLATFORM_ADMIN_ELIGIBLE_FEATURED_FIXTURE_MISSING');
  const savedFeatured=await saveFeaturedProviderDay(adminUser,{
    featureDate:featuredDate.date,targetCount:1,truckKeys:[featuredDate.candidate.truck_key],
    publicHeadline:'Managed truck feature',publicIntroduction:'Meet a featured truck and the Driver operating it.',
    tiktokUrl:null,scheduleMode:'AUTO',scheduleConfig:{dayStart:'07:30',dayEnd:'09:00',targetCount:1,
      sponsorBreakEvery:2,sponsorBreakMinutes:2},manualSchedule:[],publish:true
  });
  if(!savedFeatured?.day?.id)throw new Error('PLATFORM_ADMIN_FEATURED_SAVE_FAILED:EMPTY');featuredDayId=savedFeatured.day.id;
  const {data:savedPlacement,error:placementError}=await service.rpc('save_managed_sponsorship',{actor_user_id:admin.id,command:{
    feature_date:featuredDate.date,group_key:featuredDate.group.key,region_codes:featuredDate.group.regionCodes,sponsorship_id:'',
    sponsor_kind:'ADVERTISER',business_name:'Managed verifier',description:'Temporary advertiser for the managed platform verifier.',
    website_url:'https://example.com',phone:null,starts_on:featuredDate.date,ends_on:featuredDate.date,position:1
  }});
  if(placementError||!savedPlacement)throw new Error(`PLATFORM_ADMIN_SPONSOR_SAVE_FAILED:${placementError?.message||'EMPTY'}`);placementId=savedPlacement;
  const {data:placement}=await service.from('sponsor_placements').select('sponsor_id').eq('id',placementId).single();sponsorId=placement.sponsor_id;
  await expectError(()=>service.rpc('save_managed_sponsorship',{actor_user_id:admin.id,command:{
    feature_date:featuredDate.date,group_key:featuredDate.group.key,region_codes:featuredDate.group.regionCodes,sponsorship_id:'',
    sponsor_kind:'ADVERTISER',business_name:'Overlap verifier',description:'This overlapping advertiser must be rejected safely.',
    website_url:'https://example.org',phone:null,starts_on:featuredDate.date,ends_on:featuredDate.date,position:1
  }}),'SPONSORSHIP_OVERLAP');
  await service.rpc('disable_managed_sponsorship',{actor_user_id:admin.id,sponsorship_id:placementId}).then(({error})=>{if(error)throw error;});

  for(const [name,args] of [
    ['managed_admin_operation_counts',{actor_user_id:admin.id}],
    ['managed_admin_operations_page',{actor_user_id:admin.id,requested_view:'USERS',search_text:'',requested_offset:0,requested_limit:1}],
    ['managed_admin_operation_record',{actor_user_id:admin.id,requested_view:'USERS',record_id:customerId,requested_kind:''}],
    ['managed_admin_record_command',{actor_user_id:admin.id,record_type:'USER',record_id:customerId,command:{action:'SET_ACTIVE',active:true}}],
    ['managed_admin_featured_day',{actor_user_id:admin.id,requested_date:featuredDate.date,requested_group_key:featuredDate.group.key,requested_region_codes:featuredDate.group.regionCodes}],
    ['save_managed_featured_truck_day',{actor_user_id:admin.id,command:{}}]
  ]){
    const {error}=await anon.rpc(name,args);if(!error)throw new Error(`PLATFORM_ADMIN_ANONYMOUS_RPC_ALLOWED:${name}`);
  }
  process.stdout.write('Supabase bounded platform inventory, delegated permission denial, reversible admin commands, featured/sponsor atomicity, safe projection, and browser denial checks passed.\n');
}finally{
  if(placementId)await service.from('sponsor_placements').delete().eq('id',placementId);
  if(sponsorId)await service.from('sponsors').delete().eq('id',sponsorId);
  if(featuredDayId)await service.from('featured_provider_days').delete().eq('id',featuredDayId);
  await service.from('audit_logs').delete().gte('created_at',startedAt);
  await service.from('subscriptions').delete().eq('id',subscriptionId);
  await service.from('profile_routes').delete().eq('id',routeId);
  await service.from('vehicles').delete().eq('id',vehicleId);
  await service.from('organizations').delete().eq('id',organizationId);
  for(const id of [customerId,driverId,supportId])if(id)await service.auth.admin.deleteUser(id);
}
