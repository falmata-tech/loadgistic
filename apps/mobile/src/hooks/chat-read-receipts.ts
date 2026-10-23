import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {AppState,Platform,type LayoutChangeEvent,type NativeScrollEvent,type NativeSyntheticEvent} from 'react-native';
import {chatReadState,mergeChatReadState,visibleChatSequence} from '../../../../src/lib/chat-read-policy.js';
import type {ChatReadState} from '../../../../src/lib/chat-alert-contract';
import {setVisibleChat,chatReadingBlocked,watchChatReading} from '../session/chat-visibility';
type Request=(body?:unknown)=>Promise<unknown>;
export function useChatReadReceipts(key:string,request:Request,enabled:boolean,sequences:readonly number[]){
 const [state,setState]=useState<ChatReadState|null>(null),[denied,setDenied]=useState(false);
 const latest=useRef<ChatReadState|null>(null),geometry=useRef({offset:0,height:0,messages:new Map<number,{sequence:number;top:number;height:number}>(),presence:null as {top:number;height:number}|null});
 const report=useRef(()=>{});
 const displayed=useRef(new Set<number>());useLayoutEffect(()=>{displayed.current=new Set(sequences);for(const key of geometry.current.messages.keys())if(!displayed.current.has(key))geometry.current.messages.delete(key);report.current();},[sequences]);
 useFocusEffect(useCallback(()=>{
  latest.current=null;setState(null);setDenied(false);if(!enabled)return;
  let disposed=false,reading=false,writing=false,interacting=true,forbidden=false,timer:ReturnType<typeof setTimeout>|undefined,writeTimer:ReturnType<typeof setTimeout>|undefined,ack:{version:number;through:number}|null=null;
  const focused=()=>!forbidden&&!chatReadingBlocked()&&AppState.currentState==='active'&&interacting&&(Platform.OS!=='web'||typeof document!=='undefined'&&document.visibilityState==='visible'&&document.hasFocus());
  const update=(value:unknown)=>{const next=mergeChatReadState(latest.current,chatReadState(value));latest.current=next;setState(next);};
  const check=()=>{
   clearTimeout(writeTimer);if(disposed)return;const view=geometry.current;
   const sequence=visibleChatSequence({active:enabled,focused:focused(),offset:view.offset,height:view.height,messages:[...view.messages.values()].filter(item=>displayed.current.has(item.sequence))});
   const presence=focused()&&!!view.presence&&view.presence.top<view.offset+view.height&&view.presence.top+view.presence.height>view.offset;
   const through=sequence??(presence?0:null);setVisibleChat(key,through);
   const current=latest.current;if(writing||through===null||!current||through>current.latestSequence||through<=current.ownSeen&&!(presence&&current.ownSide==='TEAM'&&!current.teamJoined))return;
   if(ack?.version===current.assignmentVersion&&through<=ack.through)return;
   const version=current.assignmentVersion;
   writeTimer=setTimeout(async()=>{if(disposed||!focused()||writing||through>0&&!displayed.current.has(through))return;writing=true;
    try{const value=await request({throughSequence:through,assignmentVersion:version});if(!disposed){update(value);ack={version,through};}}
    catch(error){if(!disposed&&(error as {status?:number}).status===403){forbidden=true;setDenied(true);setVisibleChat(key,null);}}
    finally{writing=false;if(!disposed)writeTimer=setTimeout(check,3000);}
   },250);
  };
  report.current=check;
  const stopOverlay=watchChatReading(()=>{check();clearTimeout(timer);void poll();});
  const poll=async()=>{if(disposed||reading||!focused())return;reading=true;
   try{const value=await request();if(!disposed){update(value);check();}}
   catch(error){if(!disposed&&(error as {status?:number}).status===403){forbidden=true;setDenied(true);setVisibleChat(key,null);}}
   finally{reading=false;if(!disposed)timer=setTimeout(poll,5000);}
  };
  const resume=()=>{check();clearTimeout(timer);void poll();};
  const change=AppState.addEventListener('change',resume),blur=Platform.OS==='android'?AppState.addEventListener('blur',()=>{interacting=false;check();}):null,focus=Platform.OS==='android'?AppState.addEventListener('focus',()=>{interacting=true;resume();}):null;
  if(Platform.OS==='web'){window.addEventListener('focus',resume);window.addEventListener('blur',check);document.addEventListener('visibilitychange',resume);}
  void poll();
  return()=>{disposed=true;stopOverlay();report.current=()=>{};setVisibleChat(key,null);clearTimeout(timer);clearTimeout(writeTimer);change.remove();blur?.remove();focus?.remove();if(Platform.OS==='web'){window.removeEventListener('focus',resume);window.removeEventListener('blur',check);document.removeEventListener('visibilitychange',resume);}};
 },[key,request,enabled]));
 const messageLayout=(sequence:number)=>(event:LayoutChangeEvent)=>{const {y,height}=event.nativeEvent.layout;geometry.current.messages.set(sequence,{sequence,top:y,height});report.current();};
 const presenceLayout=(event:LayoutChangeEvent)=>{const {y,height}=event.nativeEvent.layout;geometry.current.presence={top:y,height};report.current();};
 const pageProps={onScroll:(event:NativeSyntheticEvent<NativeScrollEvent>)=>{geometry.current.offset=event.nativeEvent.contentOffset.y;geometry.current.height=event.nativeEvent.layoutMeasurement.height;report.current();},onLayout:(event:LayoutChangeEvent)=>{geometry.current.height=event.nativeEvent.layout.height;report.current();},scrollEventThrottle:100};
 return {state,denied,messageLayout,presenceLayout,pageProps};
}
