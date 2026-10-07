import { privateFilePayload } from '@/lib/mobile/file-contract.js';
import { z } from 'zod';
import { mobileActor, mobileBody, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { mobileUpload, fileFailure } from '@/lib/mobile/file-server';
import { readOwnProviderProfileImage, updateProviderProfileImage, removeProviderProfileImage } from '@/lib/provider-profile.js';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try { const user = await mobileActor(request);
  if (user.driver_kind === 'COMPANY') throw new MobileError(403, 'FORBIDDEN', 'Your fleet owner manages the transporter profile.');
  try {
   if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    const upload = await mobileUpload(request);
    if (!z.object({ action: z.literal('UPLOAD') }).strict().safeParse(upload.command).success || !['image/jpeg', 'image/png', 'image/webp'].includes(upload.file.type)) throw new MobileError(400, 'INVALID_INPUT', 'Choose a JPG, PNG or WebP image.');
    await updateProviderProfileImage(user, upload.file);
   } else {
    if (!z.object({ action: z.literal('REMOVE'), confirm: z.literal(true) }).strict().safeParse(await mobileBody(request)).success) throw new MobileError(400, 'INVALID_INPUT', 'Confirm removing your profile image.');
    await removeProviderProfileImage(user);
   }
  } catch (error) { fileFailure(error); }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}

export async function GET(request: Request) {
 try { const user = await mobileActor(request);
  try { const file = await readOwnProviderProfileImage(user); if (!file) throw new Error('NOT_FOUND'); return mobileJson(privateFilePayload(file.bytes, file.mimeType)); } catch (error) { fileFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
