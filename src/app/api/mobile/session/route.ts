import { mobileActor, mobileFailure, mobileJson } from '@/lib/mobile/server';
import { mobileIdentity } from '@/lib/mobile/identity-policy.js';
import { getManagedWorkspaceAccess } from '@/lib/identity/workspace-access.js';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { const user = await mobileActor(request, true); return mobileJson({ user: mobileIdentity(user), access: getManagedWorkspaceAccess(user) }); }
  catch (error) { return mobileFailure(error); }
}
