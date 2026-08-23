import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { addTrackingUpdate } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login',request.url),303);
  const { id } = await params;
  const form = await request.formData();
  const automatic=request.headers.get('x-loadgistic-automatic-location')==='1';
  try {
    const result=await addTrackingUpdate(user,id,{locationArea:text(form,'locationArea'),approximateLat:text(form,'approximateLat'),approximateLng:text(form,'approximateLng'),locationPrecisionKm:text(form,'locationPrecisionKm'),locationSource:text(form,'locationSource')});
    if(automatic)return NextResponse.json({ok:true,...result});
    return redirectWith(request,`/app/shipments/${id}`,'success','Tracking update recorded.');
  } catch (error) {
    if(automatic)return NextResponse.json({ok:false,error:errorMessage(error)},{status:400});
    return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));
  }
}
