import {retiredPlatformCapacityResponse} from '@/lib/retired-brokerage';
import { mobileProfilePublished } from '@/lib/mobile/profile-state';
import { z } from 'zod';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { listPrivateCapacityNetwork, grantPrivateCapacityAccess, namePrivateCapacityContact, revokePrivateCapacityAccess } from '@/lib/private-capacity.js';
export const runtime = 'nodejs';
const command = z.discriminatedUnion('action', [
 z.object({ action: z.literal('GRANT'), vehicleId: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u) }).strict(),
 z.object({ action: z.literal('NAME'), grantId: z.string().uuid(), name: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u) }).strict(),
 z.object({ action: z.literal('REVOKE'), grantId: z.string().uuid() }).strict(),
]);
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
export async function GET(request: Request) {
 try { const user = await mobileActor(request), data = await listPrivateCapacityNetwork(user);
  return mobileJson({ profilePublished: await mobileProfilePublished(user), vehicles: data.map((value: unknown) => { const item = row(value), grants = Array.isArray(item.grants) ? item.grants.map(row) : [];
   return { id: text(item.id), label: [item.make, item.model, item.platform_number].filter(Boolean).join(' · '), driver: text(item.driver_name),
    sharingMode: text(item.sharing_mode), exclusiveEmail: text(item.exclusive_email),
    businessGrants:(Array.isArray(item.business_grants)?item.business_grants.map(row):[]).filter(grant=>!grant.revoked_at).map(grant=>({id:text(grant.id),name:text(grant.name),handle:text(grant.handle),city:typeof grant.city==='string'?grant.city:null,revision:Number(grant.revision)})),
    grants: grants.filter(grant => grant.audience_type === 'EMAIL' && !grant.revoked_at).map(grant => ({ id: text(grant.id), name: text(grant.recipient_name), email: text(grant.recipient_email), addedBy: text(grant.created_by_name) })),
   };
  }) });
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await mobileActor(request), body=await mobileBody(request);
  if(row(body).action==='LOADGISTIC')return retiredPlatformCapacityResponse();
  const parsed = command.safeParse(body);
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check the vehicle, contact name and email address.');
  const input = parsed.data;
  try { if (input.action === 'GRANT') await grantPrivateCapacityAccess(user, input);
   else if (input.action === 'NAME') await namePrivateCapacityContact(user, input);
   else if (input.action === 'REVOKE') await revokePrivateCapacityAccess(user, input.grantId);
   else throw new MobileError(400,'INVALID_INPUT','Check the sharing action.');
  } catch (error) { if (error instanceof Error && ['NOT_FOUND', 'FORBIDDEN'].includes(error.message)) throw new MobileError(404, 'NOT_FOUND', 'You cannot manage sharing for this vehicle.'); throw error; }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
