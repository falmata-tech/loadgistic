import { placeLocalName } from './place-labels.js';
import { normalizePlace } from './route-matching.js';

export async function searchPlaces(query,limit=20){
  const normalized=normalizePlace(placeLocalName(query));
  if(normalized.length<2)return [];
  const boundedLimit=Math.max(1,Math.min(Number(limit)||20,50));
  if(process.env.DATA_BACKEND==='supabase'){
    const {searchSupabasePlaces}=await import('./repository/supabase.js');
    return searchSupabasePlaces(query,normalized,boundedLimit);
  }
  const repository=await import('./repository.js');
  return repository.searchPlaces(query,boundedLimit);
}
