import {trackingSessionApiPathAllowed} from '../../../../src/lib/mobile/tracking-session-path.js';
import { ApiError, readApiResponse } from './response';
import { Platform } from 'react-native';
import { capacityUrl } from './public-capacity';
import {businessApiPathAllowed,businessApiArrayResponse} from '../../../../src/lib/mobile/business-api-path.js';
import {cargoPhotoApiPathAllowed} from './cargo-space-photo-path';
export { ApiError } from './response';
const configured = Platform.OS === 'web' && __DEV__ && typeof window !== 'undefined'
 ? window.location.origin
 : process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:3100' : 'http://127.0.0.1:3100') : 'https://loadgistic.com');
export const apiOrigin = new URL(capacityUrl(configured, '')).origin;
if (!__DEV__ && !apiOrigin.startsWith('https://')) throw new Error('HTTPS is required for installed releases');
export async function apiRequest(path: string, options: { token?: string; trackingGrant?:string;method?:'GET'|'POST'|'DELETE'; body?: unknown; signal?: AbortSignal } = {}): Promise<unknown> {
  const method=options.method||(options.body===undefined?'GET':'POST');
  if(options.trackingGrant&&(!/^[A-Za-z0-9._-]{1,4096}$/.test(options.trackingGrant)||options.token||!(method==='DELETE'&&path==='/api/tracking/access'||method==='GET'&&/^\/api\/tracking\/sessions\/[0-9a-f-]{36}$/i.test(path))))throw new Error('Invalid API path');
  const trackingPath=trackingSessionApiPathAllowed(path,method),cargoPhotoPath=cargoPhotoApiPathAllowed(path,method);
  if(options.method&&!trackingPath&&!cargoPhotoPath)throw new Error('Invalid API path');
  if ((!trackingPath&&!path.startsWith('/api/mobile/')&&!businessApiPathAllowed(path)&&!cargoPhotoPath) || path.includes('..')||/[\u0000-\u001f\u007f\\#]/.test(path)) throw new Error('Invalid API path');
  const multipart = options.body instanceof FormData;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), multipart ? 60000 : 20000);
  const abort = () => controller.abort(); options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const response = await fetch(`${apiOrigin}${path}`, { method, credentials: 'omit', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),...(options.trackingGrant?{'x-loadgistic-tracking-grant':options.trackingGrant}:{}) },
      ...(options.body === undefined ? {} : { body: multipart ? options.body as FormData : JSON.stringify(options.body) }),
    });
    return await readApiResponse(response,{allowArray:businessApiArrayResponse(path)});
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'CONNECTION_FAILED', controller.signal.aborted ? 'The request took too long. Please try again.' : 'Could not connect. Check your connection and try again.');
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
}
