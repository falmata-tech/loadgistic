import { mobileProfilePublished } from '@/lib/mobile/profile-state';
import { mobileActor, mobileFailure, mobileJson } from '@/lib/mobile/server';
import { getDashboard } from '@/lib/workspace.js';
import { mobileIdentity } from '@/lib/mobile/identity-policy.js';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const user = await mobileActor(request);
    const data = await getDashboard(user);
    const counts = Object.entries(data.counts || {}).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])).map(([label, value]) => ({ label, value }));
    const recent = (Array.isArray(data.recent) ? data.recent : []).map((item: Record<string, unknown>) => ({
      id: String(item.id || ''), code: String(item.code || ''), origin: String(item.origin || ''), destination: String(item.destination || ''),
      summary: String(item.cargo_summary || item.title || ''), status: String(item.operational_status || ''),
    }));
    return mobileJson({ user: mobileIdentity(user), profilePublished: await mobileProfilePublished(user), counts, recent });
  } catch (error) { return mobileFailure(error); }
}
