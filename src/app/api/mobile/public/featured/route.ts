import { getDailyFeaturedProviders } from '@/lib/public-featured.js';
import { nativeFeatured } from '@/lib/mobile/public-contract.js';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { mobileFailure, mobileJson } from '@/lib/mobile/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{const feature=nativeFeatured(await getDailyFeaturedProviders());return mobileJson({...feature,trucks:feature.trucks.map(truck=>({...truck,image:vehicleConfigurationImage(truck.configuration)}))});}catch(error){return mobileFailure(error);}}
