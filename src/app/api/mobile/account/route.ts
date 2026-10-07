import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { updateOwnAccountDetails } from '@/lib/identity/account-details';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { const user = await mobileActor(request, true); return mobileJson({ name: user.name, phone: user.phone || '', email: user.email }); }
  catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await mobileActor(request, true);
    try { await updateOwnAccountDetails(user, await mobileBody(request)); }
    catch (error) { if (error instanceof Error && error.message === 'INVALID_ACCOUNT_DETAILS') throw new MobileError(400, 'INVALID_INPUT', 'Enter a name and valid phone number.'); throw error; }
    return mobileJson({ ok: true });
  } catch (error) { return mobileFailure(error); }
}
