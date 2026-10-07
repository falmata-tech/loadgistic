import { mobileActor, mobileBody, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { getProviderCapacityWorkspace, addProviderRegularCapacity, removeProviderRegularCapacity } from '@/lib/provider-capacity.js';
import { regularCommand, regularService } from '@/lib/mobile/regular-contract';
import { errorMessage } from '@/lib/errors';
export const runtime = 'nodejs';
async function owner(request: Request) { const user = await mobileActor(request); if (user.driver_kind === 'COMPANY') throw new MobileError(403, 'FORBIDDEN', 'Your fleet owner manages regular service.'); return user; }
export async function GET(request: Request) {
 try { const user = await owner(request); return mobileJson({ services: regularService(await getProviderCapacityWorkspace(user)) }); } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await owner(request), parsed = regularCommand.safeParse(await mobileBody(request));
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Choose the cities and confirm the requested action.');
  const input = parsed.data;
  try { if (input.action === 'REMOVE') await removeProviderRegularCapacity(user, input.id); else await addProviderRegularCapacity(user, input, input.replaceId); }
  catch (error) { const code = error instanceof Error ? error.message : '';
   if (['FORBIDDEN', 'NOT_FOUND', 'SUBSCRIPTION_ACCESS_REQUIRED'].includes(code)) throw new MobileError(403, 'FORBIDDEN', 'This regular service is not available to this account.');
   if (/^(INVALID_|REGULAR_|CAPACITY_|LOCALITY_)/.test(code)) throw new MobileError(400, 'INVALID_INPUT', errorMessage(error)); throw error;
  }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
