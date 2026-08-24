import { createSupabaseAdminClient } from '../supabase-adapter.js';

const PLACE_TYPE_ORDER=new Map([
  ['city',0],['town',1],['suburb',2],['neighbourhood',3],['quarter',4],['village',5]
]);

function safeSearchToken(value){
  return String(value||'').replace(/[,%()_*]/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
}

export async function searchSupabasePlaces(query,normalized,limit=20){
  const boundedLimit=Math.max(1,Math.min(Number(limit)||20,50));
  const normalizedToken=safeSearchToken(normalized);
  const rawToken=safeSearchToken(query);
  if(normalizedToken.length<2)return [];
  const client=createSupabaseAdminClient();
  const filters=[`normalized_name.ilike.*${normalizedToken}*`];
  if(rawToken.length>=2)filters.push(`alternate_names.ilike.*${rawToken}*`);
  const {data,error}=await client.from('place_catalog')
    .select('id,name,normalized_name,alternate_names,place_type,latitude,longitude,population,wikidata_id,source,parent_name,country_name,country_code')
    .or(filters.join(','))
    .limit(Math.max(100,boundedLimit*4));
  if(error)throw new Error('SUPABASE_PLACE_SEARCH_FAILED',{cause:error});
  return projectSupabasePlaces(data,normalizedToken,boundedLimit);
}

export function projectSupabasePlaces(data,normalizedToken,limit=20){
  const boundedLimit=Math.max(1,Math.min(Number(limit)||20,50));
  return (data||[]).sort((first,second)=>{
    const firstName=String(first.normalized_name||'');
    const secondName=String(second.normalized_name||'');
    const firstMatch=firstName===normalizedToken?0:firstName.startsWith(normalizedToken)?1:2;
    const secondMatch=secondName===normalizedToken?0:secondName.startsWith(normalizedToken)?1:2;
    if(firstMatch!==secondMatch)return firstMatch-secondMatch;
    const firstType=PLACE_TYPE_ORDER.get(String(first.place_type))??6;
    const secondType=PLACE_TYPE_ORDER.get(String(second.place_type))??6;
    if(firstType!==secondType)return firstType-secondType;
    const populationDifference=Number(second.population||0)-Number(first.population||0);
    if(populationDifference!==0)return populationDifference;
    return String(first.name).localeCompare(String(second.name));
  }).slice(0,boundedLimit).map(place=>({
    id:place.id,
    name:place.name,
    display_name:[place.name,place.parent_name&&String(place.parent_name).toLowerCase()!==String(place.name).toLowerCase()?place.parent_name:null,place.country_name].filter(Boolean).join(', '),
    country_name:place.country_name,country_code:place.country_code,parent_name:place.parent_name,
    place_type:place.place_type,lat:place.latitude,lng:place.longitude,population:place.population,
    wikidata_id:place.wikidata_id,source:place.source
  }));
}
