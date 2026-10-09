import {stopBackgroundTracking} from '../location/background-task';
import {removeNativePushScope} from './native-push';
import { createContext, useContext, useEffect, useReducer, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from './storage';
import { apiRequest } from '../api/http';
import { createAccountController } from './account-controller';
import type { AccountSession } from './contract';
export type { AccountSession } from './contract';
const storageKey = 'loadgistic.account.refresh.v1';
type SessionContext = { session: AccountSession | null; busy: boolean; error: string; cleanupRequired: boolean; requestCode: (email: string) => Promise<string>; verifyCode: (handoff: string, code: string) => Promise<void>; signInReview:(email:string,password:string)=>Promise<void>; signOut: () => Promise<void>; reload: () => Promise<AccountSession | null>; request: (path: string, body?: unknown) => Promise<unknown> };
const Context = createContext<SessionContext | null>(null);
export function AccountProvider({ children }: PropsWithChildren) {
 const [, render] = useReducer(n => n + 1, 0);
 const [controller] = useState(() => createAccountController({ now: Date.now, changed: render, request: apiRequest,
  read: () => SecureStore.getItemAsync(storageKey), remove: () => SecureStore.deleteItemAsync(storageKey),
  write: token => SecureStore.setItemAsync(storageKey, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
 }));
 useEffect(() => {
  void controller.refresh();
  const listener = AppState.addEventListener('change', state => { controller.background(); if (state === 'active') void controller.refresh(); });
  return () => listener.remove();
 }, [controller]);
 return <Context.Provider value={{ ...controller.snapshot(), requestCode: controller.requestCode, verifyCode: controller.verifyCode, signInReview:controller.signInReview, signOut: async()=>{try{await removeNativePushScope('MEMBER');}finally{try{await stopBackgroundTracking();}finally{await controller.signOut();}}}, reload: controller.refresh, request: controller.request }}>{children}</Context.Provider>;
}
export function useAccount() { const value = useContext(Context); if (!value) throw new Error('AccountProvider required'); return value; }
