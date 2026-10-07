import { useCallback,useRef,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { apiRequest } from '../api/http';
export function usePublicQuery<T>(path:string){
 const sequence=useRef(0),active=useRef<AbortController|null>(null);
 const [state,setState]=useState<{path:string;data:T|null;loading:boolean;error:string}>({path:'',data:null,loading:true,error:''});
 const reload=useCallback(async(quiet=false)=>{
  const generation=++sequence.current;active.current?.abort();const controller=new AbortController();active.current=controller;
  if(!quiet)setState(previous=>({path,data:previous.path===path?previous.data:null,loading:true,error:''}));
  try{const data=await apiRequest(path,{signal:controller.signal}) as T;if(generation===sequence.current)setState({path,data,loading:false,error:''});}
  catch(error){if(generation===sequence.current&&!controller.signal.aborted)setState(previous=>({path,data:previous.path===path?previous.data:null,loading:false,error:error instanceof Error?error.message:'Please try again.'}));}
 },[path]);
 const refresh=useCallback(()=>reload(true),[reload]);
 useFocusEffect(useCallback(()=>{void reload();return()=>{sequence.current++;active.current?.abort();};},[reload]));
 return {data:state.path===path?state.data:null,error:state.path===path?state.error:'',loading:state.path!==path||state.loading,reload,refresh};
}
