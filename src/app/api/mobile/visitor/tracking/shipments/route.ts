import { mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { requireVisitor } from '@/lib/mobile/visitor-server';
import { listTrackingEmailShipments } from '@/lib/provider-tracking.js';
import { trackingSummary } from '@/lib/mobile/tracking-contract';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try { const session = requireVisitor(request, 'tracking'), raw = new URL(request.url).searchParams.get('page') || '1';
  if (!/^[1-9]\d{0,3}$/.test(raw)) throw new MobileError(400, 'INVALID_INPUT', 'Choose a valid page.');
  const page = Number(raw), data = await listTrackingEmailShipments(session.digest, (page - 1) * 20);
  return mobileJson({ items: data.items.map(trackingSummary), total: data.total, page, pageCount: Math.max(1, Math.ceil(data.total / 20)) });
 } catch (error) { return mobileFailure(error); }
}
