import {randomUUID} from 'node:crypto';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {
  hashTrackingAccessCode,
  randomCode,
  reviewAccessCode,
  trackingAccessCode
} from '../security.js';

const TRACKING_ERRORS=[
  'FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','NOT_FOUND','INVALID_TRACKING_INPUT',
  'INVALID_EMAIL','INVALID_CARGO_SUMMARY','INVALID_TRACKING_MODE','LOCALITY_REQUIRED',
  'ROUTE_LOCATIONS_MUST_DIFFER','INVALID_DELIVERY_DATE','INVALID_VEHICLE',
  'DRIVER_REQUIRED_FOR_SHIPMENT','TRACKING_ALREADY_EXISTS','INVALID_STATUS_TRANSITION',
  'ISSUE_NOTE_REQUIRED','PROOF_NOT_ALLOWED_FOR_STATUS','INVALID_PRIVATE_PROOF',
  'ASSIGNED_DRIVER_LOCATION_REQUIRED','TRACKING_DEVICE_LOCATION_REQUIRED',
  'TRACKING_LOCATION_NOT_ENABLED','INVALID_TRACKING_CODE','REVIEW_NOT_ALLOWED',
  'INVALID_RATING','REVIEW_ALREADY_SUBMITTED','REVIEW_DISPUTE_NOT_ALLOWED',
  'REVIEW_ALREADY_DISPUTED','REVIEW_DISPUTE_REASON_REQUIRED',
  'INVALID_RATING_REVIEW_STATUS','RATING_REVIEW_NOTE_REQUIRED','RATING_ALREADY_REVIEWED'
];

function trackingError(fallback,error){
  const message=String(error?.message||'');
  const known=TRACKING_ERRORS.find(code=>message.includes(code));
  return new Error(known||fallback,{cause:error});
}

function payload(value){
  return value&&typeof value==='object'&&'payload' in value?value.payload:value;
}

export async function getSupabaseProviderTrackingWorkspace(user,options={}){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_tracking_workspace',{
    actor_user_id:user.id,requested_limit:Math.max(1,Math.min(100,Number(options.limit)||50))
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_TRACKING_WORKSPACE_FAILED',error);
  return data||{vehicles:[],shipments:[],access:{can_manage_tracking:false}};
}

export async function createSupabaseProviderShipment(user,input){
  const id=randomUUID();
  const code=randomCode('LGX');
  const ownerCode=trackingAccessCode(id);
  const reviewCode=reviewAccessCode(id);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('create_provider_tracking',{
    actor_user_id:user.id,
    command:{
      id,code,vehicle_id:String(input.vehicleId||''),
      origin_place_ref:String(input.originPlaceRef||''),
      destination_place_ref:String(input.destinationPlaceRef||''),
      cargo_summary:String(input.cargoSummary||''),
      customer_email:String(input.customerEmail||''),
      expected_pickup_date:String(input.expectedPickupDate||''),
      expected_delivery_date:String(input.expectedDeliveryDate||''),
      tracking_mode:String(input.trackingMode||'STATUS_ONLY'),
      tracking_code_hash:hashTrackingAccessCode(ownerCode),
      review_code_hash:hashTrackingAccessCode(reviewCode)
    }
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_TRACKING_CREATE_FAILED',error);
  const created=payload(data)||{};
  return {id:created.id||id,code:created.code||code,trackingCode:ownerCode,trackingPath:'/track'};
}

export async function listSupabaseProviderShipments(user,options={}){
  const workspace=await getSupabaseProviderTrackingWorkspace(user,options);
  return workspace.shipments||[];
}

export async function getSupabaseProviderShipment(user,id){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_tracking_detail',{
    actor_user_id:user.id,shipment_lookup:String(id||'')
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_TRACKING_DETAIL_FAILED',error);
  if(!data)return null;
  const shipment=payload(data);
  return {
    ...shipment,
    tracking_access_code:shipment.guest_access_active?trackingAccessCode(shipment.id):null,
    tracking_path:'/track'
  };
}

export async function updateSupabaseProviderShipmentStatus(user,id,nextStatus,note='',proof=null,locationInput=null){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('update_provider_tracking_status',{
    actor_user_id:user.id,target_shipment_id:String(id||''),
    command:{
      next_status:String(nextStatus||''),note:String(note||''),
      proof:proof?{path:proof.path,original_name:proof.originalName,mime_type:proof.mimeType}:null,
      location:locationInput?{
        area:String(locationInput.locationArea||''),lat:String(locationInput.approximateLat||''),
        lng:String(locationInput.approximateLng||''),precision_km:String(locationInput.locationPrecisionKm||''),
        source:String(locationInput.locationSource||'')
      }:null
    }
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_TRACKING_STATUS_FAILED',error);
  return payload(data);
}

export async function updateSupabaseProviderShipmentLocation(user,id,input){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('update_provider_tracking_location',{
    actor_user_id:user.id,target_shipment_id:String(id||''),
    command:{
      area:String(input.locationArea||''),lat:String(input.approximateLat||''),
      lng:String(input.approximateLng||''),precision_km:String(input.locationPrecisionKm||''),
      source:String(input.locationSource||'')
    }
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_TRACKING_LOCATION_FAILED',error);
  return payload(data);
}

export async function unlockSupabaseProviderTracking(code){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('unlock_provider_tracking',{
    tracking_code_hash:hashTrackingAccessCode(code)
  });
  if(error)throw trackingError('INVALID_TRACKING_CODE',error);
  return payload(data);
}

export async function unlockSupabaseProviderReview(shipmentId,code){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('unlock_provider_review',{
    target_shipment_id:String(shipmentId||''),supplied_code_hash:hashTrackingAccessCode(code)
  });
  if(error)throw trackingError('REVIEW_NOT_ALLOWED',error);
  return payload(data);
}

export async function getSupabaseProviderGuestTracking(id,partyRole){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_guest_tracking',{
    target_shipment_id:String(id||''),requested_party_role:String(partyRole||'')
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_GUEST_TRACKING_FAILED',error);
  return data?payload(data):null;
}

export async function purgeExpiredSupabaseProviderShipmentGuests(limit=100){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_tracking_guest_cleanup',{
    requested_limit:Math.max(1,Math.min(500,Number(limit)||100))
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_TRACKING_CLEANUP_FAILED',error);
  return payload(data)||{count:0,shipmentIds:[]};
}

export async function listSupabasePendingProviderTrackingEmails(limit=20){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('pending_provider_tracking_email_deliveries',{
    requested_limit:Math.max(1,Math.min(100,Number(limit)||20))
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_TRACKING_EMAIL_QUEUE_FAILED',error);
  return (data||[]).map(payload);
}

export async function recordSupabaseProviderTrackingEmailAttempt(id,{sent,error}={}){
  const client=createSupabaseAdminClient();
  const {error:rpcError}=await client.rpc('record_provider_tracking_email_attempt',{
    delivery_id:String(id||''),was_sent:Boolean(sent),failure_message:sent?null:String(error||'DELIVERY_FAILED')
  });
  if(rpcError)throw trackingError('SUPABASE_PROVIDER_TRACKING_EMAIL_RECORD_FAILED',rpcError);
}

export async function submitSupabaseProviderReview(shipmentId,partyRole,rating,note=''){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('submit_provider_tracking_review',{
    target_shipment_id:String(shipmentId||''),requested_party_role:String(partyRole||''),
    requested_rating:Number(rating),requested_note:String(note||'')
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_REVIEW_SUBMIT_FAILED',error);
  return data;
}

export async function disputeSupabaseProviderReview(user,reviewId,reason){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('dispute_provider_tracking_review',{
    actor_user_id:user.id,target_review_id:String(reviewId||''),requested_reason:String(reason||'')
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_REVIEW_DISPUTE_FAILED',error);
}

export async function listSupabaseProviderReviewModeration(user,status='PENDING',options={}){
  const pageSize=Math.max(1,Math.min(100,Number(options.pageSize)||12));
  const page=Math.max(1,Number(options.page)||1);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_review_moderation_queue',{
    actor_user_id:user.id,requested_status:String(status||'PENDING').toUpperCase(),
    requested_offset:(page-1)*pageSize,requested_limit:pageSize
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_REVIEW_QUEUE_FAILED',error);
  const rows=data||[];
  const items=rows.map(row=>payload(row));
  const total=Number(rows[0]?.total_count||0);
  return {items,total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
}

export async function resolveSupabaseProviderReview(user,reviewId,status,note=''){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('resolve_provider_review_dispute',{
    actor_user_id:user.id,target_review_id:String(reviewId||''),
    requested_resolution:String(status||'').toUpperCase(),requested_note:String(note||'')
  });
  if(error)throw trackingError('SUPABASE_PROVIDER_REVIEW_RESOLUTION_FAILED',error);
}
