import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { searchPlaces } from '@/lib/repository.js';

export const runtime = 'nodejs';

export async function GET(request:NextRequest) {
  if (!await getCurrentUser()) return NextResponse.json({results:[]},{status:401});
  const query = request.nextUrl.searchParams.get('q') || '';
  return NextResponse.json({results:searchPlaces(query,20)});
}
