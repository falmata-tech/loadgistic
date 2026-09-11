import {getSupabaseDailyFeaturedTrucks} from './repository/supabase.js';

export async function getDailyFeaturedProviders(date){
  return getSupabaseDailyFeaturedTrucks(date);
}
