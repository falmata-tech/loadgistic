import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { setShipmentParties } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login',request.url),303);
  const { id } = await params;
  const form = await request.formData();
  try {
    await setShipmentParties(user,id,{
      ownerPartyRole:text(form,'ownerPartyRole'),counterpartyType:text(form,'counterpartyType'),
      counterpartyRef:text(form,'counterpartyRef'),externalCounterpartyName:text(form,'externalCounterpartyName'),
      receiverFirstName:text(form,'receiverFirstName'),receiverPhone:text(form,'receiverPhone')
    });
    return redirectWith(request,`/app/shipments/${id}`,'success','Receiver contact saved.');
  } catch (error) {
    return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));
  }
}
