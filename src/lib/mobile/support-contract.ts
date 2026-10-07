import { z } from 'zod';
export const supportTopics = ['ACCOUNT', 'PAYMENT', 'VERIFICATION', 'LOAD_TRACKING', 'CAPACITY', 'OTHER'] as const;
const body = z.string().trim().min(1).max(2000);
export const startSupport = z.object({ category: z.enum(supportTopics), body }).strict();
export const supportCommand = z.discriminatedUnion('action', [
 z.object({ action: z.literal('SEND'), body }).strict(),
 z.object({ action: z.literal('END'), confirm: z.literal(true) }).strict(),
]);
export const supportQuery = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).strict();
export const supportCursor = z.object({ before: z.string().uuid().optional() }).strict();
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
export function supportSummary(value: unknown) {
 const item = row(value);
 return { id: text(item.id), category: text(item.category), status: text(item.status), agent: text(item.assigned_agent_name), preview: text(item.last_message_preview), updatedAt: text(item.updated_at), messageCount: Number(item.message_count) || 0 };
}
export function supportThread(value: unknown, userId: string) {
 const item = row(value);
 // The service authorizes too; this projection must never become a staff inbox.
 if (item.customer_user_id !== userId) throw new Error('NOT_FOUND');
 return { ...supportSummary(item), before: text(item.history_before), hasOlder: item.has_older === true, nextBefore: text(item.next_before),
  messages: (Array.isArray(item.messages) ? item.messages : []).map(value => { const message = row(value); return {
   id: text(message.id), mine: message.sender_user_id === userId, body: text(message.body), createdAt: text(message.created_at),
   attachment: message.attachment_id ? { id: text(message.attachment_id), name: text(message.attachment_name) } : null,
  }; }),
 };
}
