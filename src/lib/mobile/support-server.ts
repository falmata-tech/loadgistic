import { MobileError } from './server';
import { fileFailure } from './file-server';
export function supportFailure(error: unknown): never {
 if (error instanceof MobileError) throw error;
 const code = error instanceof Error ? error.message : '';
 if (['FORBIDDEN', 'NOT_FOUND'].includes(code)) throw new MobileError(404, 'NOT_FOUND', 'This conversation is not available to this account.');
 if (code === 'SUPPORT_CONVERSATION_ALREADY_OPEN') throw new MobileError(409, code, 'You already have an active chat. Refresh Support to open it.');
 if (code === 'SUPPORT_CONVERSATION_CLOSED') throw new MobileError(409, code, 'This chat has ended. Start a new chat if you need more help.');
 if (['SUPPORT_MESSAGE_RATE_LIMITED', 'SUPPORT_UPLOAD_BUSY'].includes(code)) throw new MobileError(429, code, 'Please wait a moment before sending another message.');
 if (['INVALID_SUPPORT_CATEGORY', 'INVALID_SUPPORT_MESSAGE', 'INVALID_SUPPORT_CURSOR', 'ATTACHMENT_REQUIRED'].includes(code)) throw new MobileError(400, 'INVALID_INPUT', 'Choose a topic and enter a message of up to 2,000 characters.');
 fileFailure(error);
}
