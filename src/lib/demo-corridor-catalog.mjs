import source from '../../resources/fixtures/demo-corridor-catalog.json' with {type:'json'};

function freeze(value){
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
 return value;
}
export const DEMO_CORRIDOR_CATALOG=freeze(source);
const refs=points=>points.map(point=>point.place_ref);
const equal=(first,second)=>JSON.stringify(first)===JSON.stringify(second);
const denied=()=>{throw Error('DEMO_WORLD_ROUTE_REFUSED');};

/** City corridor approval is exact ordered evidence, never a driving trace. */
export function validateDemoCorridorCatalog(fixture,catalog=DEMO_CORRIDOR_CATALOG){
 if(catalog?.schema_version!==1||catalog.catalog_version!==2||catalog.purpose!=='PLANNED_MARKET_CORRIDORS'
  ||!Array.isArray(catalog.routes)||!Array.isArray(catalog.targets))denied();
 const keys=new Set();
 for(const route of catalog.routes){
  if(!route?.key||keys.has(route.key)||route.kind!=='PLANNED_CITY_CORRIDOR'
   ||route.evidence?.file!=='resources/fixtures/managed-market.json'||route.evidence.table!=='capacities'
   ||route.evidence.id!==route.key||!Array.isArray(route.points)||route.points.length<2||route.points.length>5
   ||route.points.some(point=>typeof point?.place_ref!=='string'||!point.place_ref
    ||!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lng)||Math.abs(point.lng)>180)
   ||new Set(refs(route.points)).size!==route.points.length)denied();
  const capacity=fixture?.tables?.capacities?.find(row=>row.id===route.evidence.id);
  let points=capacity?.current_route_points_json;
  if(typeof points==='string'){try{points=JSON.parse(points);}catch{denied();}}
  if(capacity?.availability_geometry!=='ROUTE'||!Array.isArray(points)
   ||!equal(points.map(({place_ref,lat,lng})=>({place_ref,lat,lng})),route.points))denied();
  keys.add(route.key);
 }
 const targetKeys=new Set();
 for(const target of catalog.targets){
  if(!target?.key||targetKeys.has(target.key)||!target.vehicle_fixture_key
   ||!Array.isArray(target.alternate_route_keys)
   ||new Set(target.alternate_route_keys).size!==target.alternate_route_keys.length
   ||target.baseline_route_key!==null&&!keys.has(target.baseline_route_key)
   ||target.alternate_route_keys.some(key=>!keys.has(key)||key===target.baseline_route_key))denied();
  const vehicle=fixture?.tables?.vehicles?.find(row=>row.id===target.vehicle_fixture_key);
  if(!vehicle)denied();
  if(target.baseline_route_key!==null){
   const baseline=fixture.tables.capacities.find(row=>row.id===target.baseline_route_key);
   if(baseline?.vehicle_id!==target.vehicle_fixture_key)denied();
  }
  targetKeys.add(target.key);
 }
 return true;
}

/** Exact target-bound baseline/alternate sequences; known cities cannot be remixed. */
export function approvedDemoCorridor(targetKey,vehicleFixtureKey,placeRefs,{alternate=false,catalog=DEMO_CORRIDOR_CATALOG}={}){
 const target=catalog.targets.find(row=>row.key===targetKey);
 if(!target||target.vehicle_fixture_key!==vehicleFixtureKey||!Array.isArray(placeRefs))return false;
 const allowed=alternate?target.alternate_route_keys:[target.baseline_route_key];
 return allowed.some(key=>{
  const route=catalog.routes.find(row=>row.key===key);
  return route&&equal(placeRefs,refs(route.points));
 });
}
