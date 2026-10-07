import { z } from 'zod';
import { mobileActor, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { requireVisitor } from '@/lib/mobile/visitor-server';
import { readProviderTrackingProof } from '@/lib/provider-tracking.js';
import { privateFilePayload } from '@/lib/mobile/file-contract.js';
import { fileFailure } from '@/lib/mobile/file-server';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
 try { const user = await mobileActor(request);
  const ids = z.object({ id: z.string().uuid(), eventId: z.string().uuid() }).safeParse(await context.params);
  if (!ids.success) throw new MobileError(404, 'NOT_FOUND', 'This proof is not available.');
  try { const file = await readProviderTrackingProof(user, ids.data.id, ids.data.eventId); if (!file) throw new Error('NOT_FOUND');
   return mobileJson(privateFilePayload(file.bytes, file.mimeType));
  } catch (error) { fileFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
