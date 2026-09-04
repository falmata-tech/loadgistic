import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { createProviderShipment } from '@/lib/provider-tracking.js';
import { deliverPendingShipmentEmails } from '@/lib/email-delivery';
import { errorMessage } from '@/lib/errors';
import { text } from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Log in to start Tracking.'},{status:401});
  const form=await request.formData();
  try{
    const created=await createProviderShipment(user,{
      vehicleId:text(form,'vehicleId'),
      origin:text(form,'origin'),originPlaceRef:text(form,'originPlaceRef'),
      destination:text(form,'destination'),destinationPlaceRef:text(form,'destinationPlaceRef'),
      cargoSummary:text(form,'cargoSummary'),customerEmail:text(form,'customerEmail'),
      additionalRecipientEmails:text(form,'additionalRecipientEmails').split(/[\s,;]+/).filter(Boolean),
      expectedPickupDate:text(form,'expectedPickupDate'),expectedDeliveryDate:text(form,'expectedDeliveryDate'),
      trackingMode:text(form,'trackingMode')
    });
    await deliverPendingShipmentEmails(25);
    return NextResponse.json(created,{status:201,headers:{'cache-control':'no-store'}});
  }catch(error){return NextResponse.json({error:errorMessage(error)},{status:400,headers:{'cache-control':'no-store'}});}
}
