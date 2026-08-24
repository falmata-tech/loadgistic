import { NextRequest, NextResponse } from 'next/server.js';
import { searchPlaces } from '@/lib/place-search.js';

export const runtime = 'nodejs';

export async function GET(request:NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  return NextResponse.json(
    {results:await searchPlaces(query,20)},
    {headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}}
  );
}
