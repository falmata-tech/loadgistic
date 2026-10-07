import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAccount } from '../session/provider';

// Reload on navigation focus; stale/blurred requests cannot replace newer data.
// A different identity or query never renders the previous response.
export function useAccountQuery<T>(path: string) {
  const account = useAccount(), request = account.request, userId = account.session?.user.id;
  const key = `${userId || ''}:${path}`, sequence = useRef(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: string; loading: boolean }>({ key: '', data: null, error: '', loading: true });
  const reload = useCallback(async (quiet = false) => {
    if (!userId) return;
    const generation = ++sequence.current;
    if (!quiet) setState(previous => ({ key, data: previous.key === key ? previous.data : null, error: '', loading: true }));
    try {
      const data = await request(path) as T;
      if (generation === sequence.current) setState({ key, data, error: '', loading: false });
    } catch (error) {
      if (generation === sequence.current) setState(previous => ({ ...previous, key, error: error instanceof Error ? error.message : 'Could not load. Please try again.', loading: false }));
    }
  }, [key, path, request, userId]);
  const refresh = useCallback(() => reload(true), [reload]);
  useFocusEffect(useCallback(() => { void reload(); return () => { sequence.current++; }; }, [reload]));
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : '', loading: state.key !== key || state.loading, reload, refresh };
}
