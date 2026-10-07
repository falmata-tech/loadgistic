import { z } from 'zod';
export const paymentCommand = z.object({ amountEtb: z.number().finite().positive().max(100000000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001), reference: z.string().trim().max(160).default('') }).strict();
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
export function billingSummary(value: unknown, accessValue: unknown) {
 const data = row(value), subscription = row(data.subscription), access = row(accessValue), page = row(data.proofPage);
 return { plan: text(subscription.plan_name), status: text(access.status), granted: access.granted === true, endsAt: text(access.ends_at),
  canSubmit: Boolean(subscription.id) && !['SPONSORED', 'FREE_ACCESS'].includes(text(access.status)), page: Number(page.page) || 1, pageCount: Number(page.pageCount) || 1,
  proofs: (Array.isArray(page.items) ? page.items : []).map(value => { const item = row(value); return { id: text(item.id), amountMinor: Number(item.amount_minor), reference: text(item.reference), hasFile: item.has_file === true, status: text(item.status), submittedAt: text(item.submitted_at) }; }) };
}
