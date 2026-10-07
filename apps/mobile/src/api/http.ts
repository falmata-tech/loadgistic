import { ApiError, readApiResponse } from './response';
import { Platform } from 'react-native';
import { capacityUrl } from './public-capacity';
export { ApiError } from './response';
const configured = Platform.OS === 'web' && __DEV__ && typeof window !== 'undefined'
 ? window.location.origin
 : process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:3100' : 'http://127.0.0.1:3100') : 'https://loadgistic.com');
export const apiOrigin = new URL(capacityUrl(configured, '')).origin;
if (!__DEV__ && !apiOrigin.startsWith('https://')) throw new Error('HTTPS is required for installed releases');
export async function apiRequest(path: string, options: { token?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<unknown> {
  if (!path.startsWith('/api/mobile/') || path.includes('..')) throw new Error('Invalid API path');
  const multipart = options.body instanceof FormData;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), multipart ? 60000 : 20000);
  const abort = () => controller.abort(); options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const response = await fetch(`${apiOrigin}${path}`, { method: options.body === undefined ? 'GET' : 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      ...(options.body === undefined ? {} : { body: multipart ? options.body as FormData : JSON.stringify(options.body) }),
    });
    return await readApiResponse(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'CONNECTION_FAILED', controller.signal.aborted ? 'The request took too long. Please try again.' : 'Could not connect. Check your connection and try again.');
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
}
