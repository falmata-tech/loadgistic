import { z } from 'zod';
import { mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { requireVisitor } from '@/lib/mobile/visitor-server';
import { getProviderGuestTracking, submitTrackingEmailReview } from '@/lib/provider-tracking.js';
import { guestTrackingDetail } from '@/lib/mobile/tracking-contract';
import { trackingFailure } from '@/lib/mobile/tracking-server';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
async function accessible(request: Request, context: Context) {
 const session = await requireVisitor(request, 'tracking'), id = z.string().uuid().safeParse((await context.params).id);
 if (!id.success) throw new MobileError(404, 'NOT_FOUND', 'This shipment is not available.');
 const data = await getProviderGuestTracking(id.data, session.digest);
 if (!data) throw new MobileError(404, 'NOT_FOUND', 'This shipment is no longer shared with this email.');
 return { session, data, id: id.data };
}
export async function GET(request: Request, context: Context) {
 try { const { data } = await accessible(request, context); return mobileJson(guestTrackingDetail(data)); }
 catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request, context: Context) {
 try { const { session, data, id } = await accessible(request, context);
  if (data.recipient_role !== 'OWNER' || !data.can_review) throw new MobileError(403, 'FORBIDDEN', 'Only the customer owner may review a completed shipment once.');
  const rate = await checkRateLimit(requestKey(request, `tracking-review-submit:${id}`), 5, 60 * 60000);
  if (!rate.allowed) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait and try again.');
  const parsed = z.object({ rating: z.number().int().min(1).max(5), note: z.string().trim().max(1000).default(''),termsAccepted:z.literal(true) }).strict().safeParse(await mobileBody(request));
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Choose a rating from 1 to 5.');
  try { await submitTrackingEmailReview(id, session.digest, parsed.data.rating, parsed.data.note); } catch (error) { trackingFailure(error); }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
