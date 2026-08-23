import {NextResponse} from 'next/server.js';

export function POST(){
  return NextResponse.json({error:'The former partner network is retired. Use the truck-specific capacity Network.'},{status:410});
}
