import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { searchDirectory } from '@/lib/repository.js';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({results:[]},{status:401});
  const query=request.nextUrl.searchParams.get('q')||'';
  const kind=request.nextUrl.searchParams.get('kind')||'ALL';
  return NextResponse.json({results:searchDirectory(user,query,kind,20)});
}
