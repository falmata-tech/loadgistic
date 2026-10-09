import {contentBlocks} from '../content-blocks.js';
const choices = {
 status: ['', 'EMPTY', 'PARTIAL'], loadType: ['', 'FTL', 'PTL'],
 stopOption: ['', 'MULTI_PICK', 'MULTI_DROP'], freshness: ['', 'FRESH', 'UPDATE_NEEDED'],
 directionMode: ['', 'DIRECT', 'EITHER'],
};
const documents = { ownerDocs: ['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'], driverDocs: ['IDENTITY','DRIVER_IDENTITY'], truckDocs: ['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION'] };
const strings = ['q','provider','truck','vehicleCategory','truckCityPlaceRef','originPlaceRef','destinationPlaceRef'];
const numbers = { page:[1,10000], truckLocationRadiusKm:[5,300], originRadiusKm:[5,300], destinationRadiusKm:[5,300], nearLat:[-90,90], nearLng:[-180,180], nearRadiusKm:[5,300] };
export function discoveryFilters(params) {
 const result = {};
 const fail = () => { throw new Error('INVALID_DISCOVERY_FILTER'); };
 for (const [key, value] of params) {
  if (Object.hasOwn(result,key)) fail();
  if (strings.includes(key)) { if (value.length > (key.endsWith('PlaceRef') ? 200 : 120)) fail(); result[key]=value.trim(); }
  else if (key==='blocked') { if(value.length>8192)fail();let parsed;try{parsed=JSON.parse(value);}catch{fail();}if(!Array.isArray(parsed)||parsed.length>100||contentBlocks(parsed).length!==parsed.length)fail();result[key]=JSON.stringify(parsed); }
  else if (key==='cursor') { if (value.length>2048) fail(); result[key]=value; }
  else if (Object.hasOwn(choices,key)) { if (!choices[key].includes(value)) fail(); result[key]=value; }
  else if (Object.hasOwn(documents,key)) { const values=value?value.split(','):[]; if (values.some(v=>!documents[key].includes(v))||new Set(values).size!==values.length) fail(); result[key]=values.join(','); }
  else if (Object.hasOwn(numbers,key)) { const [min,max]=numbers[key], n=Number(value); if (!value||!Number.isFinite(n)||n<min||n>max||(key==='page'&&!Number.isInteger(n))) fail(); result[key]=value; }
  else fail();
 }
 if (result.nearRadiusKm&&!['5','10','20','50','100'].includes(result.nearRadiusKm)) fail();
 if (result.loadType==='FTL'&&result.status==='PARTIAL') fail();
 if (('nearLat' in result)!==('nearLng' in result)) fail();
 if (result.truckCityPlaceRef&&('nearLat' in result)) fail();
 return result;
}
const kinds=new Set(['COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER','COMPANY_DRIVER']);
const text=v=>typeof v==='string'?v:'';
export function discoveryProfiles(result) {
 if (result.filterError) throw new Error('INVALID_DISCOVERY_FILTER');
 return { items:(result.items||[]).filter(row=>kinds.has(row.kind)&&row.matching_trucks>0).map(row=>({
  key:text(row.key), kind:row.kind==='OWNER_OPERATOR'?'SELF_MANAGED_DRIVER':row.kind,title:text(row.title),description:text(row.description),
  handle:text(row.handle),city:text(row.city),matchingTrucks:row.matching_trucks,
  capacityId:row.kind==='COMPANY_DRIVER'?text(row.capacity_id):'',
 })), total:result.total,page:result.page,pageSize:result.pageSize,hasMore:result.hasMore };
}
