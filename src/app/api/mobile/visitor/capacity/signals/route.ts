import { mobileFailure, mobileJson } from '@/lib/mobile/server';
import { requireVisitor } from '@/lib/mobile/visitor-server';
import { readDiscoveryFilters } from '@/lib/mobile/discovery-server';
import { listSharedCapacity } from '@/lib/private-capacity.js';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try { const session = await requireVisitor(request, 'capacity'), filters = readDiscoveryFilters(request);
  // Existing service projects only signals shared with this verified recipient.
  return mobileJson(await listSharedCapacity(session.digest, filters));
 } catch (error) { return mobileFailure(error); }
}
