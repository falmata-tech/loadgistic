import {normalizePlace} from './route-matching.js';

export async function resolveCapacityFilterPlace(client,placeRef,label){
  const reference=String(placeRef||'').trim(),name=String(label||'').trim();
  if(!reference&&!name)return null;
  const query=client.from('place_catalog').select('id,name,parent_name,country_name,latitude,longitude');
  const {data,error}=reference
    ?await query.eq('id',reference).maybeSingle()
    :await query.eq('normalized_name',normalizePlace(name)).order('population',{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
  if(error)throw new Error('SUPABASE_PLACE_LOOKUP_FAILED',{cause:error});
  if(!data)throw new Error('INVALID_CAPACITY_PLACE');
  return {place_ref:data.id,place_label:[data.name,data.parent_name&&data.parent_name!==data.name?data.parent_name:null,data.country_name].filter(Boolean).join(', '),center_lat:Number(data.latitude),center_lng:Number(data.longitude)};
}

export async function resolveCapacityFilterPlaces(client,filters){
  try{
    const places=await Promise.all([
      resolveCapacityFilterPlace(client,filters.originPlaceRef,filters.origin),
      resolveCapacityFilterPlace(client,filters.destinationPlaceRef,filters.destination),
      resolveCapacityFilterPlace(client,filters.currentAreaPlaceRef,filters.currentArea),
      resolveCapacityFilterPlace(client,filters.truckCityPlaceRef,filters.truckCity)
    ]);
    return {places,filterError:null};
  }catch(error){
    if(error.message!=='INVALID_CAPACITY_PLACE')throw error;
    return {places:[],filterError:'Choose a suggested place for each location filter, or clear it to search without that location.'};
  }
}
