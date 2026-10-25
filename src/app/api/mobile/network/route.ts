import {retiredPlatformCapacityResponse} from '@/lib/retired-brokerage';
import { mobileProfilePublished } from '@/lib/mobile/profile-state';
import { z } from 'zod';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { listPrivateCapacityNetwork, revokePrivateCapacityAccess } from '@/lib/private-capacity.js';
export const runtime = 'nodejs';
const command = z.discriminatedUnion('action', [
 z.object({ action: z.literal('REVOKE'), grantId: z.string().uuid() }).strict(),
]);
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
export async function GET(request: Request) {
  try { const user = await mobileActor(request), data = await listPrivateCapacityNetwork(user);
  return mobileJson({ profilePublished: await mobileProfilePublished(user), vehicles: data.map((value: unknown) => { const item = row(value);
   return { id: text(item.id), label: [item.make, item.model, item.platform_number].filter(Boolean).join(' · '), driver: text(item.driver_name),
    sharingMode: text(item.sharing_mode),
    businessGrants:(Array.isArray(item.business_grants)?item.business_grants.map(row):[]).filter(grant=>!grant.revoked_at).map(grant=>({id:text(grant.id),name:text(grant.name),handle:text(grant.handle),city:typeof grant.city==='string'?grant.city:null,revision:Number(grant.revision)})),
    accountGrants:(Array.isArray(item.account_grants)?item.account_grants.map(row):[]).filter(grant=>grant.effective===true).map(grant=>({id:text(grant.id),name:text(grant.recipient_name),connectionId:text(grant.connection_id),revision:Number(grant.revision)})),
   };
  }) });
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await mobileActor(request), body=await mobileBody(request);
  if(row(body).action==='LOADGISTIC')return retiredPlatformCapacityResponse();
  if(row(body).action==='GRANT'||row(body).action==='NAME')throw new MobileError(410,'EMAIL_CAPACITY_RETIRED','Share with a shipper or broker account in Network.');
  const parsed = command.safeParse(body);
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check the sharing action.');
  const input = parsed.data;
  try { if (input.action === 'REVOKE') await revokePrivateCapacityAccess(user, input.grantId);
   else throw new MobileError(400,'INVALID_INPUT','Check the sharing action.');
  } catch (error) { if (error instanceof Error && ['NOT_FOUND', 'FORBIDDEN'].includes(error.message)) throw new MobileError(404, 'NOT_FOUND', 'You cannot manage sharing for this vehicle.'); throw error; }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
