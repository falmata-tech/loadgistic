import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useVisitor } from '../session/visitor-provider';
import type { VisitorScope } from '../session/visitor-controller';
import {ApiError} from '../api/http';
export function useVisitorQuery<T>(scope: VisitorScope, path: string,parse?:(value:unknown)=>T) {
 const visitor = useVisitor(), controller = visitor.controller, identity = visitor.snapshot[scope]?.startedAt;
 const key = `${scope}:${identity || ''}:${path}`, sequence = useRef(0);
 const pending=useRef<{key:string;controller:AbortController;promise:Promise<void>}|null>(null);
 const [state, setState] = useState<{ key: string; data: T | null; error: string; errorStatus:number; loading: boolean }>({ key: '', data: null, error: '', errorStatus:0, loading: true });
 const reload = useCallback(async (passive=false) => {
  if(pending.current?.key===key)return pending.current.promise;
  const generation = ++sequence.current;
  const abort=new AbortController();
  setState(previous => ({ key, data: previous.key === key ? previous.data : null, error: '', errorStatus:0, loading: true }));
  const task=(async()=>{
   try { const raw = await controller.request(scope, path,undefined,abort.signal,passive),result=parse?parse(raw):raw as T; if (sequence.current === generation) setState({ key, data: result, error: '', errorStatus:0, loading: false }); }
   catch (error) { if (sequence.current === generation&&!abort.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : 'Could not load. Please try again.', errorStatus:error instanceof ApiError?error.status:0, loading: false }); }
  })();
  pending.current={key,controller:abort,promise:task};
  try {await task;}finally{if(pending.current?.controller===abort)pending.current=null;}
 }, [controller, key, path, scope,parse]);
 useFocusEffect(useCallback(() => { if (identity) void reload(); return () => { sequence.current++;pending.current?.controller.abort();pending.current=null; }; }, [identity, reload]));
 return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : '', errorStatus:state.key===key?state.errorStatus:0, loading: state.key !== key || state.loading, reload };
}
