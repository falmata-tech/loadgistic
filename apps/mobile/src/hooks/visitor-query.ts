import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useVisitor } from '../session/visitor-provider';
import type { VisitorScope } from '../session/visitor-controller';
export function useVisitorQuery<T>(scope: VisitorScope, path: string) {
 const visitor = useVisitor(), controller = visitor.controller, identity = visitor.snapshot[scope]?.startedAt;
 const key = `${scope}:${identity || ''}:${path}`, sequence = useRef(0);
 const [state, setState] = useState<{ key: string; data: T | null; error: string; loading: boolean }>({ key: '', data: null, error: '', loading: true });
 const reload = useCallback(async () => {
  const generation = ++sequence.current;
  setState(previous => ({ key, data: previous.key === key ? previous.data : null, error: '', loading: true }));
  try { const result = await controller.request(scope, path) as T; if (sequence.current === generation) setState({ key, data: result, error: '', loading: false }); }
  catch (error) { if (sequence.current === generation) setState({ key, data: null, error: error instanceof Error ? error.message : 'Could not load. Please try again.', loading: false }); }
 }, [controller, key, path, scope]);
 useFocusEffect(useCallback(() => { if (identity) void reload(); return () => { sequence.current++; }; }, [identity, reload]));
 return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : '', loading: state.key !== key || state.loading, reload };
}
