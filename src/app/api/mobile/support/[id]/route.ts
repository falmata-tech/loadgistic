import { z } from 'zod';
import { mobileActor, mobileBody, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { supportCommand, supportCursor, supportThread } from '@/lib/mobile/support-contract';
import { supportFailure } from '@/lib/mobile/support-server';
import { mobileUpload } from '@/lib/mobile/file-server';
import { getSupportConversation, sendSupportMessage, closeSupportConversation } from '@/lib/support.js';
import { sendSupportAttachment } from '@/lib/support-attachments.js';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
async function conversationId(context: Context) { const id = z.string().uuid().safeParse((await context.params).id); if (!id.success) throw new MobileError(404, 'NOT_FOUND', 'This conversation is not available.'); return id.data; }
export async function GET(request: Request, context: Context) {
 try { const user = await mobileActor(request, true), id = await conversationId(context), query = supportCursor.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) throw new MobileError(400, 'INVALID_INPUT', 'Choose a valid message history page.');
  try { return mobileJson(supportThread(await getSupportConversation(user, id, { beforeMessageId: query.data.before, markRead:false, messageLimit: 50 }), user.id)); }
  catch (error) { supportFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request, context: Context) {
 try { const user = await mobileActor(request, true), id = await conversationId(context);
  const upload = request.headers.get('content-type')?.startsWith('multipart/form-data') ? await mobileUpload(request) : null;
  const input = supportCommand.safeParse(upload ? upload.command : await mobileBody(request));
  if (!input.success || upload && input.data.action !== 'SEND') throw new MobileError(400, 'INVALID_INPUT', 'Check your message or confirm ending the chat.');
  try {
   if (input.data.action === 'END') await closeSupportConversation(user, id);
   else if (upload) await sendSupportAttachment(user, id, input.data.body, upload.file);
   else await sendSupportMessage(user, id, input.data.body);
   return mobileJson({ ok: true });
  } catch (error) { supportFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
