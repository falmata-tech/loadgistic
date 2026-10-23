import { z } from 'zod';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { getTrackingRecovery, recoverTracking } from '@/lib/lifecycle.js';
import { trackingRecovery } from '@/lib/mobile/tracking-contract';
import { trackingFailure } from '@/lib/mobile/tracking-server';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
async function idOf(context: Context) { const parsed = z.string().uuid().safeParse((await context.params).id); if (!parsed.success) throw new MobileError(404, 'NOT_FOUND', 'This shipment is not available.'); return parsed.data; }
export async function GET(request: Request, context: Context) {
 try { const user = await mobileActor(request, true), id = await idOf(context), data = await getTrackingRecovery(user, id);
  if (!data) throw new MobileError(404, 'NOT_FOUND', 'This shipment is not available.');
  return mobileJson(trackingRecovery(data));
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request, context: Context) {
 try { const user = await mobileActor(request, true), id = await idOf(context), body = await mobileBody(request);
  try { await recoverTracking(user, id, body); } catch (error) { trackingFailure(error); }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
