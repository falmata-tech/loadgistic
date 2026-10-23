import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAccount } from '../session/provider';
import {ApiError} from '../api/response';

// Reload on navigation focus; stale/blurred requests cannot replace newer data.
// A different identity or query never renders the previous response.
export function useAccountQuery<T>(path: string) {
  const account = useAccount(), request = account.request, userId = account.session?.user.id;
  const key = `${userId || ''}:${path}`, sequence = useRef(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: string; loading: boolean }>({ key: '', data: null, error: '', loading: true });
  const read = useCallback(async (quiet = false) => {
    if (!userId) return false;
    const generation = ++sequence.current;
    // Refocusing a loaded screen is a refresh, not a new empty screen. Keep the
    // map/list mounted; a different actor or query must start without its data.
    setState(previous => ({ key, data: previous.key === key ? previous.data : null, error: quiet && previous.key === key ? previous.error : '', loading: true }));
    try {
      const data = await request(path) as T;
      if (generation === sequence.current) {setState({ key, data, error: '', loading: false });return true;}
    } catch (error) {
      const denied=error instanceof ApiError&&[401,403,404].includes(error.status);
      if (generation === sequence.current) setState(previous => ({ key, data: !denied&&previous.key === key ? previous.data : null, error: error instanceof Error ? error.message : 'Could not load. Please try again.', loading: false }));
    }
    return false;
  }, [key, path, request, userId]);
  const reload = useCallback(async () => {await read();}, [read]);
  const refresh = useCallback(async () => {await read(true);}, [read]);
  const reloadConfirmed=useCallback(()=>read(),[read]);
  useFocusEffect(useCallback(() => { void read(); return () => { sequence.current++; }; }, [read]));
  const data=state.key === key ? state.data : null, pending=state.key !== key || state.loading;
  return { data, error: state.key === key ? state.error : '', loading: pending && data === null, refreshing: pending && data !== null, reload, refresh, reloadConfirmed };
}
