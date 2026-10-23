import { PRIVATE_UPLOAD_MAX_BYTES } from '../upload-policy.js';
export const mobileUploadBodyLimit = PRIVATE_UPLOAD_MAX_BYTES + 16384;
export async function readMobileMultipart(request) {
 if (!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get('content-type') || '')) throw new Error('MULTIPART_REQUIRED');
 const reader = request.body?.getReader(); if (!reader) throw new Error('INVALID_UPLOAD');
 const parts = []; let size = 0;
 try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
  if (size > mobileUploadBodyLimit) { await reader.cancel(); throw new Error('FILE_TOO_LARGE'); } parts.push(value);
 } } finally { reader.releaseLock(); }
 let form; try { form = await new Response(new Blob(parts), { headers: { 'Content-Type': request.headers.get('content-type') } }).formData(); } catch { throw new Error('INVALID_UPLOAD'); }
 if ([...form.keys()].some(key => !['command', 'file'].includes(key)) || form.getAll('command').length !== 1 || form.getAll('file').length !== 1) throw new Error('INVALID_UPLOAD');
 const raw = form.get('command'), file = form.get('file');
 if (typeof raw !== 'string' || raw.length > 8192 || !file || typeof file === 'string' || !file.size) throw new Error('INVALID_UPLOAD');
 if (file.size > PRIVATE_UPLOAD_MAX_BYTES) throw new Error('FILE_TOO_LARGE');
 let command; try { command = JSON.parse(raw); } catch { throw new Error('INVALID_UPLOAD'); }
 if (!command || typeof command !== 'object' || Array.isArray(command)) throw new Error('INVALID_UPLOAD');
 return { command, file };
}
export function projectVerificationCenter(data) {
 return { subjects: (data.subjects || []).map(item => ({ id: item.subject_id, kind: item.subject_type, name: item.name || '',
  allowedTypes: item.allowed_types || [], pending: item.pending_count || 0,
  vehicles: (item.vehicles || []).map(vehicle => ({ id: vehicle.id, label: vehicle.label })),
  badges: (item.badges || []).map(badge => ({ type: badge.type, verified: Boolean(badge.verified), expired: Boolean(badge.expired), reviewedAt: badge.reviewedAt || null, expiresOn: badge.expiresOn || null, vehicleLabel: badge.vehicleLabel || '' })) })),
  requests: (data.requests || []).map(item => ({ id: item.id, subjectId: item.subject_id, subjectKind: item.subject_type, name: item.document_name || '', type: item.verification_type, status: item.status, submittedAt: item.submitted_at, expiresOn: item.expires_on || null, note: item.review_note || '' })) };
}
export function privateFilePayload(bytes, mimeType) {
 if (!bytes?.length || bytes.length > PRIVATE_UPLOAD_MAX_BYTES || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('FILE_UNAVAILABLE');
 return { mimeType, base64: Buffer.from(bytes).toString('base64') };
}
