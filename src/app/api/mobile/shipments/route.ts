import { after } from 'next/server.js';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { createTracking, trackingWorkspace } from '@/lib/mobile/tracking-contract';
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
    const user = await mobileActor(request), parsed = createTracking.safeParse(await mobileBody(request));
    if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check the truck, route, cargo and customer emails.');
    let created;
    try { created = await createProviderShipment(user, parsed.data); } catch (error) { trackingFailure(error); }
    after(async () => { try { await deliverPendingShipmentEmails(25); } catch { /* Committed outbox retries separately. */ } });
    return mobileJson({ id: created.id, code: created.code }, 201);
  } catch (error) { return mobileFailure(error); }
}
