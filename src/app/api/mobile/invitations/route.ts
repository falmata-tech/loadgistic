import { mobileVerifiedIdentity, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { identityFleetInvitations, acceptFleetInvitation } from '@/lib/fleet-driver-management';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { const user = await mobileVerifiedIdentity(request); return mobileJson({ invitations: await identityFleetInvitations(user.id) }); }
  catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await mobileVerifiedIdentity(request), body = await mobileBody(request);
    if (typeof body.invitationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.invitationId)) throw new MobileError(400, 'INVALID_INPUT', 'Choose a valid invitation.');
    const invitations = await identityFleetInvitations(user.id);
    if (!invitations.some(item => item.id === body.invitationId && item.can_accept)) throw new MobileError(403, 'INVITATION_UNAVAILABLE', 'This invitation is no longer available.');
    await acceptFleetInvitation(user.id, body.invitationId);
    return mobileJson({ ok: true });
  } catch (error) { return mobileFailure(error); }
}
