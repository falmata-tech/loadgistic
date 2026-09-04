import { NextResponse } from 'next/server.js';

export const runtime='nodejs';

export function GET(){
  return NextResponse.json({
    results:[],
    error:{code:'DIRECTORY_RETIRED',message:'Use Open Transport Capacity to find current transport capacity.'}
  },{status:410,headers:{'Cache-Control':'no-store'}});
}
