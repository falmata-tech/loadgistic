import {listSupabasePublicCapacityCursor} from './repository/supabase.js';

export async function listPublicCapacityCursor(filters={},options={}){
  return listSupabasePublicCapacityCursor(filters,options);
}
