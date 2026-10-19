import {publicTruckAuthority,publicProviderAuthoritySummary} from '../public-truck-authority.js';
// Project from already-public repository records. Never spread source records.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const list=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'?value:'';
const number=value=>Number.isFinite(Number(value))?Number(value):0;
export function publicWebsite(value){try{const url=new URL(text(value));return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.toString():'';}catch{return '';}}
export function publicAsset(value){const path=text(value);return /^\/(?:marketing\/[A-Za-z0-9/_-]+\.(?:png|jpg|jpeg|webp)|vehicle-configurations\/[a-z0-9-]+\.(?:png|jpg)|api\/public\/(?:providers\/[a-z0-9_-]+\/image(?:\?v=[A-Za-z0-9%_.:-]+)?|driver-portraits\/[a-f0-9-]{36}))$/i.test(path)?path:'';}
const phone=value=>{
 const input=text(value);
 if(/[\x00-\x1f\x7f]/.test(input))return '';
 const compatible=/^\+?[0-9 ()-]{6,30}$/.test(input);
 const common=input.length<=32&&/^[0-9+() .-]+$/.test(input)&&input.replace(/\D/g,'').length>=7;
 return compatible||common?input:'';
};
const email=value=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(text(value))?value:'';
export const publicBadges=value=>list(value).map(raw=>{const row=object(raw);return {type:text(row.type),reviewed:row.verified===true&&row.expired!==true,expired:row.expired===true,reviewedAt:text(row.reviewedAt),expiresOn:text(row.expiresOn)};});
function publicTruckRegular(value){
 const signal=object(list(value)[0]);
 if(signal.geometry==='ROUTE'){const places=list(signal.route_points).slice(0,5).map(point=>text(object(point).label)).filter(Boolean);return places.length>=2?{kind:'ROUTE',places}:null;}
 if(signal.geometry==='RADIUS'){const boundary=list(signal.area_boundary).slice(0,5).map(point=>text(object(point).label)).filter(Boolean),center=text(signal.area_center_label);return center&&boundary.length>=3?{kind:'AREA',places:[center,...boundary]}:null;}
 return null;
}
export function nativePublicProvider(value){
 if(!value)return null;
 const row=object(value),fleet=object(row.fleet_page),company=row.provider_kind==='FLEET_TRANSPORTER'||Boolean(row.provider_organization_id);
 return {accountName:text(row.account_name||row.name),managerName:text(row.manager_name),name:text(row.account_name||row.name),handle:text(row.handle),kind:text(row.provider_kind_label),isCompany:company,headline:company?text(row.headline):'',about:company?text(row.about):'',services:'',city:company?text(row.city):'',image:publicAsset(row.profile_image_url),
 contacts:{phone:phone(row.contact_phone),whatsapp:company?phone(row.contact_whatsapp):'',email:company?email(row.contact_email):'',website:company?publicWebsite(row.contact_website):''},
 youtubeId:company&&/^[A-Za-z0-9_-]{11}$/.test(text(row.youtube_video_id))?row.youtube_video_id:'',
 badges:publicBadges(row.verification_badges),regular:null,...(row.authoritySummary?{authoritySummary:publicProviderAuthoritySummary(row.authoritySummary)}:{}),
 reviewCount:number(row.review_count),averageRating:row.average_rating==null?null:number(row.average_rating),reviews:list(row.reviews).map(raw=>{const review=object(raw);return {id:text(review.id),rating:number(review.rating),note:text(review.note),createdAt:text(review.created_at),disputed:review.dispute_status==='OPEN'};}),
 fleet:{page:number(fleet.page),pages:number(fleet.pageCount),total:number(fleet.total)},
 trucks:list(row.trucks).map(raw=>{const truck=object(raw),capacity=object(truck.capacity);return {...(truck.authority?{authority:publicTruckAuthority(truck.authority)}:{}),number:text(truck.platform_number),name:[text(truck.make),text(truck.model)].filter(Boolean).join(' '),configuration:text(truck.cargo_configuration),driver:text(truck.assigned_driver_first_name),portrait:publicAsset(truck.assigned_driver_portrait_url),driverKind:text(truck.driver_kind_label),phone:phone(truck.assigned_driver_phone),driverBadges:publicBadges(truck.driver_verification_badges),truckBadges:publicBadges(truck.truck_verification_badges),regular:publicTruckRegular(capacity.recurring_corridors),capacity:truck.capacity?{status:text(capacity.status),updated:text(capacity.capacity_updated_label),locationUpdated:text(capacity.location_updated_label),origin:text(capacity.origin),destination:text(capacity.destination)}:null};})};
}
export function nativeFeatured(value){
 const row=object(value),schedule=object(row.schedule),providers=list(row.providers);
 const slots=new Map(providers.map((item,index)=>[object(item).truck_key,index+1]));
 return {date:text(row.feature_date),headline:text(row.headline),introduction:text(row.introduction),theme:text(object(row.theme).label),published:row.published===true,tiktokUrl:publicWebsite(row.tiktok_url),start:text(row.broadcast_start_time),end:text(row.broadcast_end_time),
 week:list(row.week).map(raw=>{const day=object(raw);return {date:text(day.date),day:text(day.day),label:text(day.label),dateLabel:text(day.dateLabel)};}),
 programme:list(schedule.entries).map(raw=>{const entry=object(raw);return {kind:entry.type==='PROVIDER'?'TRUCK':'BREAK',slot:slots.get(entry.provider_key)||null,label:text(entry.label),startsAt:text(entry.starts_at),endsAt:text(entry.ends_at),timeLabel:text(entry.time_label)};}),
 trucks:providers.map((raw,index)=>{const truck=object(raw);return {slot:index+1,name:text(truck.name),handle:text(truck.handle),driver:text(truck.driver_first_name),driverKind:text(truck.driver_kind_label),portrait:publicAsset(truck.driver_portrait_url),truck:[text(truck.vehicle_make),text(truck.vehicle_model)].filter(Boolean).join(' ')||text(truck.vehicle_label),configuration:text(truck.cargo_configuration),place:text(truck.base_place),available:truck.public_capacity_available===true};}),
 sponsors:list(row.sponsored_providers).map(raw=>{const sponsor=object(raw);return {kind:sponsor.sponsor_kind==='TRANSPORTER'?'TRANSPORTER':'ADVERTISER',name:text(sponsor.name),handle:text(sponsor.handle),description:text(sponsor.description),website:publicWebsite(sponsor.website_url),phone:phone(sponsor.phone),image:publicAsset(sponsor.profile_image_url)};})};
}
