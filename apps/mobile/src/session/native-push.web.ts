import type {NativePushControls,NativePushInput} from './native-push-types';
export function useNativePush(_input:NativePushInput):NativePushControls{return {status:'UNSUPPORTED',optedIn:false,error:'',toggle:async()=>{}};}
export async function removeNativePushScope(_scope:'MEMBER'|'GUEST'|'ALL'):Promise<void>{}
