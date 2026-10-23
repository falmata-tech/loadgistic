// FEAT-MKT-001: one bounded canonical value per OR group; groups remain ANDed.
export const CAPACITY_FILTER_CHOICES=Object.freeze({
 vehicleCategory:Object.freeze(['Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck','Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer']),
 status:Object.freeze(['EMPTY','PARTIAL']),loadType:Object.freeze(['FTL','PTL']),
 stopOption:Object.freeze(['MULTI_PICK','MULTI_DROP']),freshness:Object.freeze(['FRESH','UPDATE_NEEDED']),
 locationSource:Object.freeze(['GPS','MOBILE','MANUAL'])
});
const fail=()=>{throw new Error('INVALID_CAPACITY_FILTER');};
export function capacityFilterValues(key,value){
 if(!Object.hasOwn(CAPACITY_FILTER_CHOICES,key))fail();
 if(value===undefined||value===null||value==='')return[];
 if(typeof value!=='string'&&!Array.isArray(value))fail();
 if(typeof value==='string'&&value.length>2048)fail();
 if(typeof value==='string'&&value.trim()==='')return[];
 const parts=Array.isArray(value)?value:value.split(',');
 if(parts.length>32)fail();
 const values=parts.map(part=>{
  if(typeof part!=='string'||part.length>128||part.trim()==='')fail();
  const token=key==='vehicleCategory'?part.trim():part.trim().toUpperCase();
  if(!CAPACITY_FILTER_CHOICES[key].includes(token))fail();return token;
 });
 return [...new Set(values)].sort();
}
export function capacityFilterValue(key,values){return capacityFilterValues(key,values).join(',');}
export function parseCapacityFilterValues(value,key){return capacityFilterValue(key,value)||null;}
export function canonicalCapacityFilters(filters={}){
 const result=Object.fromEntries(Object.keys(CAPACITY_FILTER_CHOICES).map(key=>[key,capacityFilterValue(key,filters[key])]));
 if(result.loadType==='FTL'&&result.status==='PARTIAL')fail();
 return result;
}
export function capacityFilterParams(params){
 const seen=new Set();for(const [key]of params){if(seen.has(key))fail();seen.add(key);}
 const input={};
 for(const key of Object.keys(CAPACITY_FILTER_CHOICES)){
  const values=params.getAll(key);if(values.length>1)fail();input[key]=values[0]||'';
 }
 return canonicalCapacityFilters(input);
}
export function capacityFilterRecord(record){
 const params=new URLSearchParams();
 for(const [key,value]of Object.entries(record)){
  if(value===undefined)continue;if(typeof value!=='string')fail();params.append(key,value);
 }
 return capacityFilterParams(params);
}
