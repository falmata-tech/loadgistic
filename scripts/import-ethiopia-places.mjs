import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/lib/db.js';
import { normalizePlace } from '../src/lib/route-matching.js';

const defaultJson=path.resolve('data/osm/ethiopia-settlements.json');
const sourcePath=path.resolve(process.argv[2]||(
  fs.existsSync(defaultJson)?defaultJson:'data/osm/ethiopia-latest.osm.pbf'
));
const accepted=new Set(['city','town','village','hamlet']);
const timestamp=new Date().toISOString();
const db=getDb();
const upsert=db.prepare(`INSERT INTO place_catalog
  (id,name,normalized_name,alternate_names,place_type,latitude,longitude,population,wikidata_id,osm_type,osm_id,source,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,normalized_name=excluded.normalized_name,alternate_names=excluded.alternate_names,
    place_type=excluded.place_type,latitude=excluded.latitude,longitude=excluded.longitude,
    population=excluded.population,wikidata_id=excluded.wikidata_id,osm_type=excluded.osm_type,
    osm_id=excluded.osm_id,source=excluded.source,updated_at=excluded.updated_at`);
let imported=0;
let skipped=0;

if(!fs.existsSync(sourcePath)){
  console.error(`Missing ${sourcePath}`);
  console.error('Run npm run places:download, or provide a Geofabrik Ethiopia PBF path.');
  process.exit(1);
}

function alternateNames(tags){
  return [...new Set([
    tags.name,
    tags.alt_name,
    tags.short_name,
    tags['name:en'],
    tags['name:am'],
    tags['name:om'],
    tags['name:ti'],
    tags['name:so']
  ].filter(Boolean).flatMap(item=>String(item).split(';')).map(item=>item.trim()).filter(Boolean))];
}

function storePlace({id,type='node',lat,lng,tags={},source}){
  const placeType=String(tags.place||'').toLowerCase();
  const name=String(tags['name:en']||tags.name||'').trim();
  const latitude=Number(lat);
  const longitude=Number(lng);
  if(!accepted.has(placeType)||!name||!Number.isFinite(latitude)||!Number.isFinite(longitude)){
    skipped+=1;
    return;
  }
  const population=Number.parseInt(String(tags.population||''),10);
  upsert.run(
    `osm:${type}/${id}`,
    name,
    normalizePlace(name),
    alternateNames(tags).join('; '),
    placeType,
    latitude,
    longitude,
    Number.isFinite(population)?population:null,
    tags.wikidata||null,
    type,
    String(id),
    source,
    timestamp
  );
  imported+=1;
}

function runOsmium(args,stdio=['ignore','inherit','inherit']){
  return new Promise((resolve,reject)=>{
    const command=spawn('osmium',args,{stdio});
    command.on('error',reject);
    command.on('close',code=>code===0?resolve(command):reject(new Error(`osmium exited with code ${code}`)));
  });
}

db.exec('BEGIN IMMEDIATE');
try{
  if(sourcePath.endsWith('.json')){
    const document=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
    for(const element of document.elements||[]){
      storePlace({
        id:element.id,
        type:element.type,
        lat:element.lat??element.center?.lat,
        lng:element.lon??element.center?.lon,
        tags:element.tags||{},
        source:'OPENSTREETMAP_OVERPASS'
      });
    }
  }else{
    const filteredPath=path.join(path.dirname(sourcePath),'ethiopia-settlements.osm.pbf');
    await runOsmium(['tags-filter',sourcePath,'nwr/place=city,town,village,hamlet','--output',filteredPath,'--overwrite']);
    const osmium=spawn('osmium',[
      'export',filteredPath,'--add-unique-id=type_id','--output-format=geojsonseq','--output=-'
    ],{stdio:['ignore','pipe','inherit']});
    const lines=createInterface({input:osmium.stdout,crlfDelay:Infinity});
    for await(const line of lines){
      const value=line.trim().replace(/^\x1e/,'');
      if(!value)continue;
      const feature=JSON.parse(value);
      const properties=feature.properties||{};
      const coordinates=feature.geometry?.type==='Point'?feature.geometry.coordinates:feature.bbox
        ?[(feature.bbox[0]+feature.bbox[2])/2,(feature.bbox[1]+feature.bbox[3])/2]
        :null;
      storePlace({
        id:properties['@id']||feature.id,
        type:String(properties['@id']||feature.id||'node').split('/')[0],
        lat:coordinates?.[1],
        lng:coordinates?.[0],
        tags:properties,
        source:'OPENSTREETMAP_GEOFABRIK'
      });
    }
    const exitCode=await new Promise((resolve,reject)=>{
      osmium.on('error',reject);
      osmium.on('close',resolve);
    });
    if(exitCode!==0)throw new Error(`osmium exited with code ${exitCode}`);
  }
  db.exec('COMMIT');
}catch(error){
  db.exec('ROLLBACK');
  throw error;
}

console.log(`Imported ${imported} Ethiopian settlements; skipped ${skipped} incomplete records.`);
