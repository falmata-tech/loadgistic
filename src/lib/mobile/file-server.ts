import { MobileError } from './server';
import { readMobileMultipart } from './file-contract.js';
export async function mobileUpload(request: Request) {
 try { return await readMobileMultipart(request); } catch (error) { fileFailure(error); }
}
export function fileFailure(error: unknown): never {
 if (error instanceof MobileError) throw error;
 const code = error instanceof Error ? error.message : '';
 if (code === 'FILE_TOO_LARGE') throw new MobileError(413, 'FILE_TOO_LARGE', 'Choose a file smaller than 4 MB.');
 if (['FORBIDDEN', 'SUBSCRIPTION_ACCESS_REQUIRED'].includes(code)) throw new MobileError(403, 'FORBIDDEN', 'You cannot access this document.');
 if (['NOT_FOUND', 'FILE_UNAVAILABLE'].includes(code)) throw new MobileError(404, 'NOT_FOUND', 'This file is not available.');
 if (['MULTIPART_REQUIRED', 'INVALID_UPLOAD', 'UNSUPPORTED_FILE_TYPE', 'FILE_CONTENT_MISMATCH', 'INVALID_VERIFICATION_TYPE', 'TRUCK_AUTHORIZATION_DETAILS_REQUIRED', 'VERIFICATION_DOCUMENT_REQUIRED', 'VERIFICATION_ALREADY_SUBMITTED', 'VERIFICATION_ALREADY_REVIEWED'].includes(code)) throw new MobileError(400, 'INVALID_INPUT', 'Check the document details. Choose a JPG, PNG, WebP or PDF, and refresh to check whether it was already submitted.');
 throw error;
}
