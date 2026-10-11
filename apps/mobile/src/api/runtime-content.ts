import type {Featured} from './public-content.ts';
import type {TrackingSummary} from './tracking.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):value is Row=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const strings=(value:Row,keys:string[])=>keys.every(key=>typeof value[key]==='string');
const list=(value:unknown,valid:(item:unknown)=>boolean)=>Array.isArray(value)&&value.every(valid);
const integer=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const summary=(value:unknown)=>row(value)&&strings(value,['id','code','origin','destination','cargo','status','driver','truck','updatedAt']);
const event=(value:unknown)=>row(value)&&strings(value,['id','status','note','createdAt'])&&typeof value.hasProof==='boolean';
export type TrackingPage={items:TrackingSummary[];total:number;page:number;pageCount:number};
export type VisitorShipment=TrackingSummary&{provider:string;mode:string;canReview:boolean;canApprove:boolean;
 events:{id:string;status:string;note:string;hasProof:boolean;createdAt:string}[];
 location:{latitude:number;longitude:number;area:string;radius:number;updatedAt:string}|null;
 review:{rating:number;note:string}|null};

/** Validate before render: a successful HTTP status is not a data contract. */
export function parseFeatured(value:unknown):Featured{
 if(!row(value)||!strings(value,['date','headline','introduction','theme','tiktokUrl','start','end'])||typeof value.published!=='boolean'
  ||!list(value.week,item=>row(item)&&strings(item,['date','day','label','dateLabel']))
  ||!list(value.trucks,item=>row(item)&&integer(item.slot)&&strings(item,['name','handle','driver','driverKind','portrait','truck','configuration','image','place'])&&typeof item.available==='boolean')
  ||!list(value.programme,item=>row(item)&&strings(item,['kind','label','startsAt','endsAt','timeLabel'])&&(item.slot===null||integer(item.slot)))
  ||!list(value.sponsors,item=>row(item)&&strings(item,['kind','name','handle','description','website','phone','image'])))
  throw Error('Featured is unavailable right now. Please try again.');
 return value as Featured;
}
export function parseTrackingPage(value:unknown):TrackingPage{
 if(!row(value)||!list(value.items,summary)||!integer(value.total)||!integer(value.page)||!integer(value.pageCount))
  throw Error('Could not load shipment updates. Please try again.');
 return value as TrackingPage;
}
export function parseVisitorShipment(value:unknown):VisitorShipment{
 const location=row(value)?value.location:undefined,review=row(value)?value.review:undefined;
 const located=location===null||row(location)&&strings(location,['area','updatedAt'])
  &&typeof location.latitude==='number'&&Number.isFinite(location.latitude)&&Math.abs(location.latitude)<=90
  &&typeof location.longitude==='number'&&Number.isFinite(location.longitude)&&Math.abs(location.longitude)<=180
  &&typeof location.radius==='number'&&[1,3,5,10,20].includes(location.radius);
 const reviewed=review===null||row(review)&&typeof review.rating==='number'&&Number.isInteger(review.rating)&&review.rating>=1&&review.rating<=5&&typeof review.note==='string';
 if(!row(value)||!summary(value)||!strings(value,['provider','mode'])||typeof value.canReview!=='boolean'
  ||typeof value.canApprove!=='boolean'||!list(value.events,event)||!located||!reviewed)
  throw Error('Could not load shipment updates. Please try again.');
 return value as VisitorShipment;
}
