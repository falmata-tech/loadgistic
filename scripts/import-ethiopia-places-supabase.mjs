import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { normalizePlace } from '../src/lib/route-matching.js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!serviceKey)throw new Error('SUPABASE_NOT_CONFIGURED');

const sourcePath=path.resolve(process.argv[2]||'resources/geo/ethiopia-settlements.json');
if(!fs.existsSync(sourcePath))throw new Error(`Missing ${sourcePath}`);

const accepted=new Set(['city','town','village','hamlet','suburb','neighbourhood','quarter']);
const document=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const timestamp=new Date().toISOString();
const rows=[];

function alternateNames(tags){
  return [...new Set([
    tags.name,tags.alt_name,tags.short_name,tags['name:en'],tags['name:am'],tags['name:om'],tags['name:ti'],tags['name:so']
  ].filter(Boolean).flatMap(item=>String(item).split(';')).map(item=>item.trim()).filter(Boolean))];
}

for(const element of document.elements||[]){
  const tags=element.tags||{};
  const placeType=String(tags.place||'').toLowerCase();
  const name=String(tags['name:en']||tags.name||'').trim();
  const latitude=Number(element.lat??element.center?.lat);
  const longitude=Number(element.lon??element.center?.lon);
  if(!accepted.has(placeType)||!name||!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
  const population=Number.parseInt(String(tags.population||''),10);
  rows.push({
    id:`osm:${element.type}/${element.id}`,
    name,
    normalized_name:normalizePlace(name),
    alternate_names:alternateNames(tags).join('; '),
    place_type:placeType,
    latitude,
    longitude,
    population:Number.isFinite(population)?population:null,
    wikidata_id:tags.wikidata||null,
    osm_type:element.type,
    osm_id:String(element.id),
    source:'OPENSTREETMAP_OVERPASS',
    parent_place_id:null,
    parent_name:tags['addr:city']||tags['is_in:city']||(['suburb','neighbourhood','quarter'].includes(placeType)?'Addis Ababa':null),
    country_name:'Ethiopia',
    country_code:'ET',
    updated_at:timestamp
  });
}

const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
for(let offset=0;offset<rows.length;offset+=500){
  const batch=rows.slice(offset,offset+500);
  const {error}=await supabase.from('place_catalog').upsert(batch,{onConflict:'id'});
  if(error)throw new Error(`Supabase place import failed at ${offset}: ${error.message}`);
}
console.log(`Imported ${rows.length} Ethiopian settlements into Supabase.`);
