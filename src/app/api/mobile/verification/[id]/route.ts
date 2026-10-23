import { z } from 'zod';
import { mobileActor, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { getVerificationFile } from '@/lib/verification.js';
import { readPrivateUpload } from '@/lib/private-storage.js';
import { privateFilePayload } from '@/lib/mobile/file-contract.js';
import { fileFailure } from '@/lib/mobile/file-server';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
 try { const user = await mobileActor(request), id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) throw new MobileError(404, 'NOT_FOUND', 'This document is not available.');
  try { const file = await getVerificationFile(user, id.data); if (!file) throw new Error('NOT_FOUND');
   return mobileJson(privateFilePayload(await readPrivateUpload(file.file_path), file.mime_type));
  } catch (error) { fileFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
