import { commitPrivateUpload } from '@/lib/private-upload-commit.js';
import { mobileUpload, fileFailure } from '@/lib/mobile/file-server';
import { storePrivateUpload, removePrivateUpload } from '@/lib/private-storage.js';
import { getTrackingRecovery } from '@/lib/lifecycle.js';
import { after } from 'next/server.js';
import { z } from 'zod';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { trackingCommand, trackingDetail } from '@/lib/mobile/tracking-contract';
import { nativeTrackingLocation, trackingFailure } from '@/lib/mobile/tracking-server';
import { trackingNextStatuses } from '@/lib/tracking-progress.js';
import { getProviderShipment, updateProviderShipmentStatus, updateProviderShipmentLocation, addProviderTrackingRecipient, revokeProviderTrackingRecipient } from '@/lib/provider-tracking.js';
import { deliverPendingShipmentEmails } from '@/lib/email-delivery';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
async function shipmentId(context: Context) { const parsed = z.string().uuid().safeParse((await context.params).id); if (!parsed.success) throw new MobileError(404, 'NOT_FOUND', 'This shipment is not available.'); return parsed.data; }
export async function GET(request: Request, context: Context) {
  try {
    const user = await mobileActor(request,true), id = await shipmentId(context), data = await getProviderShipment(user, id);
    if (!data) throw new MobileError(404, 'NOT_FOUND', 'This shipment is not available.');
    const recovery = await getTrackingRecovery(user, id);
    return mobileJson({ ...trackingDetail(data, user, trackingNextStatuses(data.operational_status)), canRecover: Boolean(recovery?.actions?.length) });
  } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const user = await mobileActor(request,true), id = await shipmentId(context);
    const upload = request.headers.get('content-type')?.startsWith('multipart/form-data') ? await mobileUpload(request) : null;
    const parsed = trackingCommand.safeParse(upload ? upload.command : await mobileBody(request));
    if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check the update or recipient email.');
    const input = parsed.data;
    try {
      if (upload && (input.action !== 'STATUS' || !['LOADING', 'UNLOADING', 'ISSUE'].includes(input.nextStatus) || !['image/jpeg', 'image/png', 'image/webp'].includes(upload.file.type))) throw new MobileError(400, 'INVALID_INPUT', 'Photos may accompany loading, unloading or an issue.');
      if (input.action === 'STATUS') {
        let proof = null;
        if (upload) {
          const current = await getProviderShipment(user, id);
          if (!current) throw new MobileError(404, 'NOT_FOUND', 'This shipment is not available.');
          if (!trackingNextStatuses(current.operational_status).includes(input.nextStatus)) throw new MobileError(409, 'CHANGED', 'Refresh the shipment before saving this step.');
          try { proof = await storePrivateUpload(upload.file, 'tracking-proof'); } catch (error) { fileFailure(error); }
        }
        await commitPrivateUpload(proof, () => updateProviderShipmentStatus(user, id, input.nextStatus, input.note, proof, nativeTrackingLocation(input.location)), removePrivateUpload);
      }
      else if (input.action === 'LOCATION') return mobileJson(await updateProviderShipmentLocation(user, id, nativeTrackingLocation(input.location)));
      else if (input.action === 'ADD_RECIPIENT') await addProviderTrackingRecipient(user, id, input.email);
      else await revokeProviderTrackingRecipient(user, id, input.recipientId);
    } catch (error) { trackingFailure(error); }
    if (input.action === 'ADD_RECIPIENT') after(async () => { try { await deliverPendingShipmentEmails(5); } catch { /* Retained outbox is retryable. */ } });
    return mobileJson({ ok: true });
  } catch (error) { return mobileFailure(error); }
}
