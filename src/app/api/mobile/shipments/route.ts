import { after } from 'next/server.js';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { createTracking, needsTrackingRouteUpdate, trackingWorkspace } from '@/lib/mobile/tracking-contract';
import { trackingFailure } from '@/lib/mobile/tracking-server';
import { createProviderShipment, getProviderTrackingWorkspace } from '@/lib/provider-tracking.js';
import { deliverPendingShipmentEmails } from '@/lib/email-delivery';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { const user = await mobileActor(request); return mobileJson(trackingWorkspace(await getProviderTrackingWorkspace(user, { limit: 100 }))); }
  catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await mobileActor(request), input=await mobileBody(request),parsed = createTracking.safeParse(input);
    if (!parsed.success){
      if(needsTrackingRouteUpdate(input))throw new MobileError(409,'UPDATE_REQUIRED','Update Loadgistic to choose a passing-through city, or start Tracking at loadgistic.com.');
      throw new MobileError(400, 'INVALID_INPUT', 'Check the vehicle, route, cargo and customer emails.');
    }
    let created;
    try { created = await createProviderShipment(user, parsed.data); } catch (error) { trackingFailure(error); }
    after(async () => { try { await deliverPendingShipmentEmails(25); } catch { /* Committed outbox retries separately. */ } });
    return mobileJson({ id: created.id, code: created.code }, 201);
  } catch (error) { return mobileFailure(error); }
}
