export const uploadLimit = 4 * 1024 * 1024;
export function uploadForm(command: unknown, file: Blob): FormData {
 if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size <= 0 || file.size > uploadLimit || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('Choose a supported file smaller than 4 MB.');
 const body = new FormData(); body.append('command', JSON.stringify(command)); body.append('file', file); return body;
}
