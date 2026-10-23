import { z } from 'zod';
import { mobileActor, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { supportFailure } from '@/lib/mobile/support-server';
import { privateFilePayload } from '@/lib/mobile/file-contract.js';
import { readSupportAttachment } from '@/lib/support-attachments.js';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
 try { const user = await mobileActor(request, true), parsed = z.object({ id: z.string().uuid(), attachmentId: z.string().uuid() }).safeParse(await context.params);
  if (!parsed.success) throw new MobileError(404, 'NOT_FOUND', 'This attachment is not available.');
  try { const file = await readSupportAttachment(user, parsed.data.id, parsed.data.attachmentId); return mobileJson(privateFilePayload(file.bytes, file.mimeType)); }
  catch (error) { supportFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
