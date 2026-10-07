import { mobileActor, mobileBody, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { startSupport, supportQuery, supportSummary } from '@/lib/mobile/support-contract';
import { supportFailure } from '@/lib/mobile/support-server';
import { createSupportConversation, getOpenMemberSupportConversation, listMemberSupportConversations } from '@/lib/support.js';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try { const user = await mobileActor(request, true), parsed = supportQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Choose a valid history page.');
  try { const [open, history] = await Promise.all([getOpenMemberSupportConversation(user), listMemberSupportConversations(user, { page: parsed.data.page, pageSize: 10 })]);
   return mobileJson({ open: open ? supportSummary(open) : null, history: history.items.map(supportSummary), page: history.page, pageCount: history.pageCount });
  } catch (error) { supportFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await mobileActor(request, true), parsed = startSupport.safeParse(await mobileBody(request));
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Choose a topic and enter a message of up to 2,000 characters.');
  try { return mobileJson({ id: await createSupportConversation(user, parsed.data) }, 201); } catch (error) { supportFailure(error); }
 } catch (error) { return mobileFailure(error); }
}
