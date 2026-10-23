// Browser preview sessions are tab-scoped. Never present this as native keychain storage.
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 0;
function storage() {
 if (typeof window === 'undefined') return null;
 if (!__DEV__ || !['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)) {
  throw new Error('Use the Loadgistic website to sign in. This browser preview is local only.');
 }
 return window.sessionStorage;
}
export async function getItemAsync(key:string) { return storage()?.getItem(key) ?? null; }
export async function setItemAsync(key:string,value:string,_options?:{keychainAccessible:number}) { storage()?.setItem(key,value); }
export async function deleteItemAsync(key:string) { storage()?.removeItem(key); }
