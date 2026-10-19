import {z} from 'zod';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {getAdminOperationRecord,hasPlatformPermission} from './supabase.js';

export type AdminAccountActor={id:string;role:string;can_manage_customers?:boolean;can_manage_operations?:boolean;can_manage_trust?:boolean;can_manage_support?:boolean};
type Permission='CUSTOMERS'|'OPERATIONS'|'TRUST'|'SUPPORT';
type ProviderKind='ORGANIZATION'|'PROVIDER_PROFILE';
export type AccountProvider={id:string;key:string;kind:ProviderKind;name:string;city:string|null;handle:string|null;relationship:'OWNER'|'DRIVER'|'MEMBER';isTransportProvider:boolean;truckCount:number;trackingCount:number};
export type AccountSection<T>={permitted:boolean;items:T[];total:number;page:number;pageCount:number};
export type AccountTruck={id:string;platform_number:string|null;make:string;model:string;cargo_configuration:string;active:boolean;publication_status:'DRAFT'|'LIVE';driver:{id:string;name:string}|null};
export type AccountTracking={id:string;code:string;cargo_summary:string;origin:string;destination:string;operational_status:string;updated_at:string};
export type AccountDocument={id:string;document_name:string;subject_type:string;verification_type:string;status:string;submitted_at:string;expires_on:string|null;review_note:string|null};
export type AccountChat={id:string;category:string;status:string;updated_at:string;assigned_agent_user_id:string|null};
export type AccountDevice={id:string;label:string;protocol:string;active:boolean;last_seen_at:string|null};
export type AdminAccountOverview={
 account:{id:string;name:string;email:string;phone:string|null;role:string;active:boolean;created_at:string};
 providers:AccountProvider[];selectedProvider:AccountProvider|null;
 driver:{id:string;owner_id:string;owner_name:string;vehicle_id:string|null;platform_number:string|null;can_manage_capacity:boolean;can_manage_tracking:boolean}|null;
 fleet:AccountSection<AccountTruck>;tracking:AccountSection<AccountTracking>;documents:AccountSection<AccountDocument>;
 support:AccountSection<AccountChat>;devices:AccountSection<AccountDevice>;actorIsAdmin:boolean;
};
type ReadResult={data:unknown;error:unknown;count?:number|null};
const uuid=z.string().uuid(),nullableText=z.string().nullable();
const accountSchema=z.object({id:uuid,name:z.string(),email:z.string(),phone:nullableText,role:z.string(),active:z.boolean(),created_at:z.string()});
const memberSchema=z.object({organization_id:uuid,membership_role:z.string()});
const profileSchema=z.object({id:uuid});
const employmentSchema=z.object({organization_id:uuid.nullable(),provider_profile_id:uuid.nullable()}).refine(value=>Number(Boolean(value.organization_id))+Number(Boolean(value.provider_profile_id))===1);
const truckSchema=z.object({id:uuid,platform_number:nullableText,make:z.string(),model:z.string(),cargo_configuration:z.string(),active:z.boolean(),publication_status:z.enum(['DRAFT','LIVE'])});
const assignmentSchema=z.object({vehicle_id:uuid,driver_user_id:uuid});
const personSchema=z.object({id:uuid,full_name:z.string()});
const trackingSchema=z.object({id:uuid,code:z.string(),cargo_summary:z.string(),origin:z.string(),destination:z.string(),operational_status:z.string(),updated_at:z.string()});
const documentSchema=z.object({id:uuid,document_name:z.string(),subject_type:z.string(),verification_type:z.string(),status:z.string(),submitted_at:z.string(),expires_on:nullableText,review_note:nullableText});
const chatSchema=z.object({id:uuid,category:z.string(),status:z.string(),updated_at:z.string(),assigned_agent_user_id:uuid.nullable()});
const deviceSchema=z.object({id:uuid,label:z.string(),protocol:z.string(),active:z.boolean(),last_seen_at:nullableText});
const driverSchema=z.object({id:uuid,owner_id:uuid,owner_name:z.string(),vehicle_id:uuid.nullable(),platform_number:nullableText,can_manage_capacity:z.boolean(),can_manage_tracking:z.boolean()});
const workspaceSchema=z.object({id:uuid,record_kind:z.enum(['ORGANIZATION','PROVIDER_PROFILE']),type:z.string(),name:z.string(),city:nullableText,handle:nullableText,truck_count:z.number(),tracking_count:z.number()});
const pageNumber=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0&&n<=100000?n:1;};
const empty=<T>(permitted=false):AccountSection<T>=>({permitted,items:[],total:0,page:1,pageCount:1});
function rows<T>(schema:z.ZodType<T>,result:ReadResult):T[]{if(result.error)throw Error('ADMIN_ACCOUNT_READ_UNAVAILABLE');return z.array(schema).parse(result.data);}
function section<T>(items:T[],result:ReadResult,page:number):AccountSection<T>{const total=result.count??items.length;return{permitted:true,items,total,page,pageCount:Math.max(1,Math.ceil(total/5))};}

/** Server-only composite. Service-role reads are protected by explicit current
 * actor checks, exact relationship keys and final reauthorization, not by RLS. */
export async function getAdminAccountOverview(actor:AdminAccountActor,accountId:string,options:{providerKey?:string;truckPage?:unknown;trackingPage?:unknown;documentPage?:unknown;supportPage?:unknown;devicePage?:unknown}={}):Promise<AdminAccountOverview|null>{
 const id=uuid.parse(accountId),client=createSupabaseAdminClient();
 const raw=await getAdminOperationRecord(actor,'USERS',id);if(!raw)return null;
 const account=accountSchema.parse(raw);
 async function permitted(permission:Permission){
  if(!hasPlatformPermission(actor,permission))return false;
  const result=await client.rpc('managed_actor_has_permission',{actor_user_id:actor.id,permission_name:permission});
  if(result.error)throw Error('ADMIN_ACCOUNT_AUTHORITY_UNAVAILABLE');return result.data===true;
 }
 async function requireCustomers(){if(!await permitted('CUSTOMERS'))throw Error('FORBIDDEN');}
 await requireCustomers();
 async function currentActorRole(){
  const saved=await getAdminOperationRecord(actor,'USERS',actor.id);
  if(!saved)throw Error('FORBIDDEN');
  const current=accountSchema.parse(saved);
  if(!current.active||!['ADMIN','SUPPORT'].includes(current.role))throw Error('FORBIDDEN');
  return current.role;
 }
 const initialActorRole=await currentActorRole();
 async function connections(){
  const [members,profiles,employees]=await Promise.all([
   client.from('organization_members').select('organization_id,membership_role').eq('user_id',id).order('id').limit(10),
   client.from('provider_profiles').select('id').eq('user_id',id).limit(1),
   client.from('drivers').select('organization_id,provider_profile_id').eq('user_id',id).eq('active',true).limit(2)
  ]);
  const employment=rows(employmentSchema,employees);if(employment.length>1)throw Error('ACCOUNT_RELATIONSHIP_CHANGED');
  const links:{id:string;kind:ProviderKind;relationship:'OWNER'|'DRIVER'|'MEMBER'}[]=[...rows(memberSchema,members).map(member=>({id:member.organization_id,kind:'ORGANIZATION' as const,relationship:member.membership_role==='OWNER'?'OWNER' as const:member.membership_role==='DRIVER'?'DRIVER' as const:'MEMBER' as const})),
   ...rows(profileSchema,profiles).map(profile=>({id:profile.id,kind:'PROVIDER_PROFILE' as const,relationship:'OWNER' as const}))];
  for(const employee of employment){const employerId=employee.organization_id||employee.provider_profile_id!,kind=employee.organization_id?'ORGANIZATION' as const:'PROVIDER_PROFILE' as const;
   if(!links.some(link=>link.kind===kind&&link.id===employerId))links.push({id:employerId,kind,relationship:'DRIVER'});
  }
  return links;
 }
 const relationships=await connections();
 const providers:AccountProvider[]=[];
 for(const link of relationships){
  const saved=await getAdminOperationRecord(actor,'WORKSPACES',link.id,link.kind);if(!saved)throw Error('ACCOUNT_RELATIONSHIP_CHANGED');
  const provider=workspaceSchema.parse(saved);if(provider.id!==link.id||provider.record_kind!==link.kind)throw Error('ACCOUNT_RELATIONSHIP_CHANGED');providers.push({id:provider.id,key:`${link.kind}:${link.id}`,kind:link.kind,name:provider.name,city:provider.city,handle:provider.handle,relationship:link.relationship,isTransportProvider:link.kind==='PROVIDER_PROFILE'||provider.type==='TRANSPORT_COMPANY',truckCount:provider.truck_count,trackingCount:provider.tracking_count});
 }
 const selectedProvider=options.providerKey?providers.find(provider=>provider.key===options.providerKey):providers.find(provider=>provider.relationship==='OWNER')||providers[0]||null;
 if(options.providerKey&&!selectedProvider)throw Error('ACCOUNT_PROVIDER_NOT_RELATED');
 const scopeColumn=selectedProvider?.kind==='ORGANIZATION'?'organization_id':'provider_profile_id';
 const trackingColumn=selectedProvider?.kind==='ORGANIZATION'?'provider_organization_id':'provider_profile_id';
 const owns=selectedProvider?.relationship==='OWNER';
 async function operations(){
  if(!await permitted('OPERATIONS'))return {fleet:empty<AccountTruck>(),tracking:empty<AccountTracking>(),driver:null,assignmentIds:[] as string[]};
  const assignmentResult=await client.from('driver_vehicle_assignments').select('vehicle_id,driver_user_id').eq('driver_user_id',id).eq('active',true).order('assigned_at',{ascending:false}).limit(2);
  const current=rows(assignmentSchema,assignmentResult);
  if(current.length>1||current.some(item=>item.driver_user_id!==id))throw Error('ACCOUNT_ASSIGNMENT_AMBIGUOUS');
  const driverRaw=account.role==='DRIVER'?await getAdminOperationRecord(actor,'DRIVERS',id):null;
  const driver=driverRaw?driverSchema.parse(driverRaw):null;
  let fleet=empty<AccountTruck>(true),tracking=empty<AccountTracking>(true);
  if(selectedProvider&&(owns||current.length)){
   const truckPage=pageNumber(options.truckPage);
   let truckQuery=client.from('vehicles').select('id,platform_number,make,model,cargo_configuration,active,publication_status',{count:'exact'}).eq(scopeColumn,selectedProvider.id).order('active',{ascending:false}).order('platform_number').order('id');
   if(!owns)truckQuery=truckQuery.in('id',current.map(item=>item.vehicle_id));
   const truckResult=await truckQuery.range((truckPage-1)*5,truckPage*5-1),savedTrucks=rows(truckSchema,truckResult);
   const assignments=savedTrucks.length?rows(assignmentSchema,await client.from('driver_vehicle_assignments').select('vehicle_id,driver_user_id').in('vehicle_id',savedTrucks.map(truck=>truck.id)).eq('active',true).limit(5)):[];
   const people=assignments.length?rows(personSchema,await client.from('profiles').select('id,full_name').in('id',assignments.map(item=>item.driver_user_id)).limit(5)):[];
   fleet=section(savedTrucks.map(truck=>{const assignment=assignments.find(item=>item.vehicle_id===truck.id),person=people.find(item=>item.id===assignment?.driver_user_id);return{...truck,driver:person?{id:person.id,name:person.full_name}:null};}),truckResult,truckPage);
  }
  // An unassigned employee still has their own earlier Tracking history.
  if(selectedProvider&&(owns||selectedProvider.relationship==='DRIVER')){
   const trackingPage=pageNumber(options.trackingPage);
   let trackingQuery=client.from('provider_shipments').select('id,code,cargo_summary,origin,destination,operational_status,updated_at',{count:'exact'}).eq(trackingColumn,selectedProvider.id).order('updated_at',{ascending:false}).order('id');
   if(!owns)trackingQuery=trackingQuery.eq('assigned_driver_user_id',id);
   const trackingResult=await trackingQuery.range((trackingPage-1)*5,trackingPage*5-1);tracking=section(rows(trackingSchema,trackingResult),trackingResult,trackingPage);
  }
  if(!await permitted('OPERATIONS'))return {fleet:empty<AccountTruck>(),tracking:empty<AccountTracking>(),driver:null,assignmentIds:[] as string[]};
  return{fleet,tracking,driver,assignmentIds:current.map(item=>item.vehicle_id).sort()};
 }
 async function documents(){
  if(!await permitted('TRUST'))return empty<AccountDocument>();
  const page=pageNumber(options.documentPage);
  const result=await client.from('verification_requests').select('id,document_name,subject_type,verification_type,status,submitted_at,expires_on,review_note',{count:'exact'}).eq('submitted_by',id).order('submitted_at',{ascending:false}).order('id').range((page-1)*5,page*5-1);
  const data=section(rows(documentSchema,result),result,page);return await permitted('TRUST')?data:empty<AccountDocument>();
 }
 async function support(){
  if(!await permitted('SUPPORT'))return empty<AccountChat>();
  let query=client.from('support_conversations').select('id,category,status,updated_at,assigned_agent_user_id',{count:'exact'}).eq('customer_user_id',id).order('updated_at',{ascending:false}).order('id');
  if(await currentActorRole()!=='ADMIN')query=query.eq('assigned_agent_user_id',actor.id);
  const page=pageNumber(options.supportPage),result=await query.range((page-1)*5,page*5-1),items=rows(chatSchema,result),allowed:AccountChat[]=[];
  for(const chat of items){const read=await client.rpc('support_actor_can_read',{actor_user_id:actor.id,conversation_id:chat.id});if(read.error)throw Error('ADMIN_ACCOUNT_AUTHORITY_UNAVAILABLE');if(read.data===true)allowed.push(chat);}
  const data=section(allowed,{...result,count:allowed.length===items.length?result.count:allowed.length},page);return await permitted('SUPPORT')?data:empty<AccountChat>();
 }
 async function devices(){
  if(await currentActorRole()!=='ADMIN'||!selectedProvider||!owns||!await permitted('OPERATIONS'))return empty<AccountDevice>();
  const page=pageNumber(options.devicePage),result=await client.from('telematics_devices').select('id,label,protocol,active,last_seen_at',{count:'exact'}).eq(scopeColumn,selectedProvider.id).order('label').order('id').range((page-1)*5,page*5-1);
  const data=section(rows(deviceSchema,result),result,page);return await permitted('OPERATIONS')?data:empty<AccountDevice>();
 }
 const [work,documentSection,supportSection,deviceSection]=await Promise.all([operations(),documents(),support(),devices()]);
 await requireCustomers();
 const currentRelationships=await connections();
 if(JSON.stringify(currentRelationships)!==JSON.stringify(relationships))throw Error('ACCOUNT_RELATIONSHIP_CHANGED');
 const finalRaw=await getAdminOperationRecord(actor,'USERS',id);if(!finalRaw)return null;
 const finalAccount=accountSchema.parse(finalRaw);if(finalAccount.role!==account.role)throw Error('ACCOUNT_RELATIONSHIP_CHANGED');
 // Discard buffered sections if any capability changed after an independent read.
 if(await permitted('OPERATIONS')){const finalAssignments=rows(assignmentSchema,await client.from('driver_vehicle_assignments').select('vehicle_id,driver_user_id').eq('driver_user_id',id).eq('active',true).order('assigned_at',{ascending:false}).limit(2));if(finalAssignments.length>1||finalAssignments.some(item=>item.driver_user_id!==id)||JSON.stringify(finalAssignments.map(item=>item.vehicle_id).sort())!==JSON.stringify(work.assignmentIds))throw Error('ACCOUNT_RELATIONSHIP_CHANGED');}
 let finalSupport=supportSection;
 if(supportSection.permitted){
  const allowed:AccountChat[]=[];
  for(const chat of supportSection.items){const check=await client.rpc('support_actor_can_read',{actor_user_id:actor.id,conversation_id:chat.id});if(check.error)throw Error('ADMIN_ACCOUNT_AUTHORITY_UNAVAILABLE');if(check.data===true)allowed.push(chat);}
  if(allowed.length!==supportSection.items.length)finalSupport={...supportSection,items:allowed,total:allowed.length,pageCount:1};
 }
 const [operationsAllowed,trustAllowed,supportAllowed]=await Promise.all([permitted('OPERATIONS'),permitted('TRUST'),permitted('SUPPORT')]);
 await requireCustomers();
 const finalActorRole=await currentActorRole();
 if(finalActorRole!==initialActorRole)throw Error('FORBIDDEN');
 return{actorIsAdmin:finalActorRole==='ADMIN',account:finalAccount,providers,selectedProvider:selectedProvider||null,driver:operationsAllowed?work.driver:null,
  fleet:operationsAllowed?work.fleet:empty<AccountTruck>(),tracking:operationsAllowed?work.tracking:empty<AccountTracking>(),documents:trustAllowed?documentSection:empty<AccountDocument>(),support:supportAllowed?finalSupport:empty<AccountChat>(),devices:operationsAllowed?deviceSection:empty<AccountDevice>()};
}

/** Exact entity evidence, reached from an independently authorized account or
 * operational record. This is not a name-based Review Center search. */
export async function getAdminRecordDocuments(actor:AdminAccountActor,view:'TRUCKS'|'WORKSPACES',recordId:string,kind:string,pageValue?:unknown):Promise<AccountSection<AccountDocument>>{
 const id=uuid.parse(recordId),client=createSupabaseAdminClient();
 if(!hasPlatformPermission(actor,'TRUST'))return empty<AccountDocument>();
 async function authorized(){
  const result=await client.rpc('managed_actor_has_permission',{actor_user_id:actor.id,permission_name:'TRUST'});
  if(result.error)throw Error('ADMIN_ACCOUNT_AUTHORITY_UNAVAILABLE');
  if(result.data!==true)return false;
  return Boolean(await getAdminOperationRecord(actor,view,id,kind));
 }
 if(!await authorized())return empty<AccountDocument>();
 let query=client.from('verification_requests').select('id,document_name,subject_type,verification_type,status,submitted_at,expires_on,review_note',{count:'exact'});
 if(view==='TRUCKS')query=query.or(`and(subject_type.eq.VEHICLE,subject_id.eq.${id}),related_vehicle_id.eq.${id}`);
 else{
  if(!['ORGANIZATION','PROVIDER_PROFILE'].includes(kind))throw Error('INVALID_ACCOUNT_DOCUMENT_SCOPE');
  query=query.eq('subject_type',kind).eq('subject_id',id);
 }
 const page=pageNumber(pageValue),result=await query.order('submitted_at',{ascending:false}).order('id').range((page-1)*5,page*5-1);
 const data=section(rows(documentSchema,result),result,page);
 return await authorized()?data:empty<AccountDocument>();
}
