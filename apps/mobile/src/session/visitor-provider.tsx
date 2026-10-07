import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from './storage';
import { apiRequest } from '../api/http';
import { createVisitorController } from './visitor-controller';
type Controller = ReturnType<typeof createVisitorController>;
const Context = createContext<{ controller: Controller; snapshot: ReturnType<Controller['snapshot']>; ready: boolean; error: string; errors: { tracking: string; capacity: string } } | null>(null);
export function VisitorProvider({ children }: PropsWithChildren) {
 const [, render] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({ tracking: '', capacity: '' });
 const [controller] = useState(() => createVisitorController({ now: Date.now,
  read: scope => SecureStore.getItemAsync(`loadgistic.visitor.${scope}.v1`),
  write: (scope, value) => SecureStore.setItemAsync(`loadgistic.visitor.${scope}.v1`, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: scope => SecureStore.deleteItemAsync(`loadgistic.visitor.${scope}.v1`), request: apiRequest, storageError: (scope, message) => setErrors(previous => ({ ...previous, [scope]: message })), changed: () => render(value => value + 1),
 }));
 useEffect(() => {
  let mounted = true;
  const report = () => { if (mounted) setError('Could not update saved email access on this phone. Please try again.'); };
  void Promise.all([controller.restore('tracking'), controller.restore('capacity')]).catch(report).finally(() => { if (mounted) setReady(true); });
  const listener = AppState.addEventListener('change', state => { controller.setForeground(state === 'active'); void controller.expire().catch(report); });
  // Expiry only: no network request or renewal from this timer.
  const timer = setInterval(() => { void controller.expire().catch(report); }, 1000);
  return () => { mounted = false; listener.remove(); clearInterval(timer); };
 }, [controller]);
 return <Context.Provider value={{ controller, snapshot: controller.snapshot(), ready, error, errors }}>{children}</Context.Provider>;
}
export function useVisitor() { const value = useContext(Context); if (!value) throw new Error('VisitorProvider required'); return value; }
