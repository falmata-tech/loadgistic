// Source fixture preparation only. This script never connects to a database.
import fs from 'node:fs';
import {diversifyFixturePlanning} from './fixture-capacity-plans.mjs';
import {getPlaceCoordinate} from '../src/lib/ethiopia-places.js';
import {normalizePlace} from '../src/lib/route-matching.js';
import {distanceBetweenKm} from '../src/lib/domain.js';

if(process.argv.slice(2).some(arg=>arg!=='--write'))throw Error('Use --write or omit it for a preview');
const path='resources/fixtures/managed-market.json',before=fs.readFileSync(path,'utf8'),fixture=JSON.parse(before);
const settlements=JSON.parse(fs.readFileSync('resources/geo/ethiopia-settlements.json','utf8')).elements||[];
const accepted=new Set(['city','town','village','hamlet','suburb','neighbourhood','quarter']);
const places=settlements.filter(p=>p.tags?.name&&accepted.has(p.tags.place)&&Number.isFinite(p.lat??p.center?.lat)&&Number.isFinite(p.lon??p.center?.lon))
 .map(p=>({place_ref:`osm:${p.type}/${p.id}`,name:p.tags['name:en']||p.tags.name,
  names:[p.tags.name,p.tags['name:en'],p.tags.alt_name].filter(Boolean).flatMap(n=>n.split(';')).map(normalizePlace),
  lat:p.lat??p.center.lat,lng:p.lon??p.center.lon,place_type:p.tags.place}));
const savedPoints=[...fixture.tables.capacities.flatMap(c=>[...JSON.parse(c.current_route_points_json||'[]'),...JSON.parse(c.capacity_area_boundary_json||'[]')]),
 ...fixture.tables.profile_routes.flatMap(r=>[...JSON.parse(r.route_points_json||'[]'),...JSON.parse(r.area_boundary_json||'[]')])];
function canonical(point){
 const builtin=getPlaceCoordinate(point.key)||getPlaceCoordinate(point.label);
 if(builtin)return {key:normalizePlace(builtin.name).replaceAll(' ','-'),place_ref:`builtin:${normalizePlace(builtin.name)}`,
  label:`${builtin.name}, Ethiopia`,name:builtin.name,lat:builtin.lat,lng:builtin.lng,place_type:'town'};
 const saved=savedPoints.filter(p=>normalizePlace(p.name||p.label)===normalizePlace(point.key)&&distanceBetweenKm(p,point)<10)
  .sort((a,b)=>distanceBetweenKm(a,point)-distanceBetweenKm(b,point))[0];
 if(saved)return {...saved};
 const nearby=places.map(p=>({...p,distance:distanceBetweenKm(point,p)})).filter(p=>p.distance!==null&&p.distance<10)
  .sort((a,b)=>Number(b.names.includes(normalizePlace(point.key)))-Number(a.names.includes(normalizePlace(point.key)))||a.distance-b.distance);
 const selected=nearby[0];
 if(!selected||!selected.names.includes(normalizePlace(point.key))&&selected.distance>0.75)throw Error(`DEMO_PLACE_UNRESOLVED:${point.key}`);
 return {key:normalizePlace(selected.name).replaceAll(' ','-'),place_ref:selected.place_ref,label:`${selected.name}, Ethiopia`,
  name:selected.name,lat:selected.lat,lng:selected.lng,place_type:selected.place_type};
}
const tables=diversifyFixturePlanning(fixture.tables,{resolvePlace:canonical});
const changed=key=>tables[key].filter((row,index)=>JSON.stringify(row)!==JSON.stringify(fixture.tables[key][index])).length;
if(process.argv.includes('--write')){
 if(fs.readFileSync(path,'utf8')!==before)throw Error('DEMO_FIXTURE_SOURCE_CHANGED');
 fs.writeFileSync(path,JSON.stringify({...fixture,tables},null,2)+'\n');
}
console.log(JSON.stringify({written:process.argv.includes('--write'),changedCapacityPlans:changed('capacities'),changedPreferredPlans:changed('profile_routes'),hostedWrites:0}));
