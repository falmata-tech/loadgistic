import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { transitionShipment } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login',request.url),303);
  const { id } = await params;
  const form = await request.formData();
  try {
    transitionShipment(user,id,text(form,'nextStatus'),text(form,'note'));
    return redirectWith(request,`/app/shipments/${id}`,'success','Shipment status updated.');
  } catch (error) {
    return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));
  }
}
