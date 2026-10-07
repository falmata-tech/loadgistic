import { z } from 'zod';
import { mobileActor, mobileBody, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { mobileUpload, fileFailure } from '@/lib/mobile/file-server';
import { getBillingSummaryData, submitPaymentProof } from '@/lib/billing.js';
import { getManagedWorkspaceAccess } from '@/lib/identity/workspace-access.js';
import { billingSummary, paymentCommand } from '@/lib/mobile/billing-contract';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try { const user = await mobileActor(request, true), page = z.coerce.number().int().min(1).max(100000).safeParse(new URL(request.url).searchParams.get('page') || 1);
  if (!page.success) throw new MobileError(400, 'INVALID_INPUT', 'Choose a valid history page.');
  return mobileJson(billingSummary(await getBillingSummaryData(user, { page: page.data, pageSize: 10 }), getManagedWorkspaceAccess(user)));
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await mobileActor(request, true), summary = billingSummary(await getBillingSummaryData(user), getManagedWorkspaceAccess(user));
  if (!summary.canSubmit) throw new MobileError(403, 'PAYMENT_NOT_REQUIRED', 'No payment submission is needed for this account.');
  const upload = request.headers.get('content-type')?.startsWith('multipart/form-data') ? await mobileUpload(request) : null;
  const parsed = paymentCommand.safeParse(upload ? upload.command : await mobileBody(request));
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Enter an ETB amount with at most two decimal places and a transfer reference.');
  try { await submitPaymentProof(user, parsed.data.amountEtb, parsed.data.reference, upload?.file || null); }
  catch (error) { const code = error instanceof Error ? error.message : ''; if (['PAYMENT_NOT_REQUIRED', 'SUBSCRIPTION_NOT_FOUND'].includes(code)) throw new MobileError(409, 'CHANGED', 'Your plan changed. Refresh before submitting again.'); fileFailure(error); }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
