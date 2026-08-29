import { placeLocalName } from './place-labels.js';
import { normalizePlace } from './route-matching.js';
import {searchSupabasePlaces} from './repository/supabase.js';

export async function searchPlaces(query,limit=20){
  const normalized=normalizePlace(placeLocalName(query));
  if(normalized.length<2)return [];
  const boundedLimit=Math.max(1,Math.min(Number(limit)||20,50));
  return searchSupabasePlaces(query,normalized,boundedLimit);
}
