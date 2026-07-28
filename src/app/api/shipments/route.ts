import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { createShipment } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url), 303);
  const form = await request.formData();
  try {
    const result = createShipment(user, {
      title: text(form,'title'),
      serviceMode: text(form,'serviceMode'),
      distributionMode: text(form,'distributionMode'),
      priceMode: text(form,'priceMode'),
      priceEtb: text(form,'priceEtb'),
      targetPriceEtb: text(form,'targetPriceEtb'),
      ownerPartyRole:text(form,'ownerPartyRole'),
      counterpartyType:text(form,'counterpartyType'),
      counterpartyRef:text(form,'counterpartyRef'),
      externalCounterpartyName:text(form,'externalCounterpartyName'),
      externalCounterpartyPhone:text(form,'externalCounterpartyPhone'),
      providerRef: text(form,'providerRef'),
      origin: text(form,'origin'),
      destination: text(form,'destination'),
      cargoDescription: text(form,'cargoDescription'),
      packageCount: text(form,'packageCount'),
      vehicleCategory: text(form,'vehicleCategory'),
      loadType: text(form,'loadType'),
      pickupDate: text(form,'pickupDate'),
      deliveryDate: text(form,'deliveryDate'),
      trackingMode: text(form,'trackingMode') || 'STATUS_ONLY'
    });
    return NextResponse.redirect(new URL(`/app/shipments/${result.id}?success=Load+posted`, request.url), 303);
  } catch (error) {
    return redirectWith(request, '/app/shipments/new', 'error', errorMessage(error));
  }
}
