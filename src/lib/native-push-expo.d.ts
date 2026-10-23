import type {NativePushProvider} from './native-push-worker.js';
export function expoPushProvider(options?:{fetcher?:typeof fetch;accessToken?:string}):NativePushProvider;
