import { mobileCatalogPlace } from '@/lib/mobile/place-projection.js';
import { searchPlaces } from '@/lib/place-search.js';
import { mobileFailure, mobileJson } from '@/lib/mobile/server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const query = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 120);
    const results = await searchPlaces(query, 12);
    return mobileJson({ results: results.map((row: { id: string; display_name: string; lat: number; lng: number }) => mobileCatalogPlace({place_ref:row.id,label:row.display_name,lat:row.lat,lng:row.lng})) });
  } catch (error) { return mobileFailure(error); }
}
