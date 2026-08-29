import {getSupabaseDailyFeaturedProviders} from './repository/supabase.js';

export async function getDailyFeaturedProviders(date){
  return getSupabaseDailyFeaturedProviders(date);
}
