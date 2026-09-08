import { NextRequest, NextResponse } from 'next/server.js';
import { searchPlaces } from '@/lib/place-search.js';

export const runtime = 'nodejs';

export async function GET(request:NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  return NextResponse.json(
    {results:await searchPlaces(query,20)},
    {headers:{
      'Cache-Control':'private, no-store, max-age=0',
      'CDN-Cache-Control':'no-store',
      'Netlify-CDN-Cache-Control':'no-store'
    }}
  );
}
