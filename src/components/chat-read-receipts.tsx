'use client';
import React from 'react';
import {Check,CheckCheck} from 'lucide-react';
import {Text} from './localization';
import type {ChatReadState} from '@/lib/chat-alert-contract';
import {chatReadState,mergeChatReadState} from '@/lib/chat-read-policy.js';
const Context=React.createContext(null as ChatReadState|null);
function displayed(node:HTMLElement){
 if(!node.isConnected)return false;const rect=node.getBoundingClientRect();
 let left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(innerWidth,rect.right),bottom=Math.min(innerHeight,rect.bottom);
 for(let parent=node.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll|hidden|clip/.test(style.overflow+style.overflowY+style.overflowX)){const bounds=parent.getBoundingClientRect();left=Math.max(left,bounds.left);right=Math.min(right,bounds.right);top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}}
 if(right<=left||bottom<=top)return false;
 return [[.5,.5],[.2,.2],[.8,.8]].some(([x,y])=>{const target=document.elementFromPoint(left+(right-left)*x,top+(bottom-top)*y);return !!target&&(target===node||node.contains(target));});
}
export function ChatReadReceipts({endpoint,chatKey,active=true,children}:{endpoint:string;chatKey:string;active?:boolean;children:React.ReactNode}){
 const root=React.useRef(null as HTMLDivElement|null),latest=React.useRef(null as ChatReadState|null);
 const acknowledged=React.useRef(null as {version:number;through:number}|null);
 const [state,setState]=React.useState(null as ChatReadState|null),[denied,setDenied]=React.useState(false);
 React.useEffect(()=>{
  const hide=()=>{if(root.current){root.current.style.visibility='hidden';root.current.dataset.chatVisibleThrough='-1';}};
  const restore=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',restore);
  return()=>{window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',restore);};
 },[]);
 const update=React.useCallback((value:unknown)=>{const next=mergeChatReadState(latest.current,chatReadState(value));latest.current=next;setState(next);},[]);
 React.useEffect(()=>{
  latest.current=null;acknowledged.current=null;setState(null);setDenied(false);if(!active)return;
  let stopped=false,running=false,etag='',timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  const poll=async()=>{
   if(stopped||running||document.visibilityState!=='visible')return;running=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
   try{const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
    if(response.status===403){if(!stopped)setDenied(true);return;}
    if(response.status!==304){if(!response.ok)throw Error('UNAVAILABLE');const value=await response.json();if(!stopped){update(value);etag=response.headers.get('etag')||'';}}
   }catch{/* Failed delivery is not a read receipt. The next bounded poll retries. */}
   finally{clearTimeout(timeout);running=false;if(!stopped)timer=setTimeout(poll,5000);}
  };
  const focus=()=>{clearTimeout(timer);void poll();};void poll();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{stopped=true;controller?.abort();clearTimeout(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[endpoint,active,update]);
 React.useEffect(()=>{
  if(!active||denied||!state||!root.current)return;
  const visible=new Set<HTMLElement>();let presence=null as HTMLElement|null,disposed=false,busy=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  const report=()=>{
   clearTimeout(timer);const focused=document.hasFocus()&&document.visibilityState==='visible';
   if(root.current&&!focused)root.current.dataset.chatVisibleThrough='-1';
   if(disposed||busy||!focused)return;
   const current=latest.current;if(!current)return;
   const shown=[...visible].filter(displayed),header=presence&&displayed(presence);
   const sequence=shown.length?Math.max(...shown.map(node=>Number(node.dataset.chatSequence))):header?0:null;
   if(root.current)root.current.dataset.chatVisibleThrough=String(sequence??-1);
   if(sequence===null||!Number.isSafeInteger(sequence)||sequence<0||sequence>current.latestSequence)return;
   if(sequence<=current.ownSeen&&!(current.ownSide==='TEAM'&&!current.teamJoined&&header))return;
   if(acknowledged.current?.version===current.assignmentVersion&&sequence<=acknowledged.current.through)return;
   const frame=current.assignmentVersion;timer=setTimeout(async()=>{
    if(disposed||busy||!document.hasFocus()||document.visibilityState!=='visible'||sequence>0&&!shown.some(node=>Number(node.dataset.chatSequence)===sequence&&displayed(node))||sequence===0&&(!presence||!displayed(presence)))return;busy=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
    try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({throughSequence:sequence,assignmentVersion:frame}),signal:controller.signal});
     if(response.status===403){if(!disposed)setDenied(true);return;}
     if(response.ok&&!disposed){update(await response.json());acknowledged.current={version:frame,through:sequence};}
    }catch{/* Retain Sent; do not optimistically claim Seen. */}
    finally{clearTimeout(timeout);busy=false;if(!disposed)timer=setTimeout(report,3000);}
   },250);
  };
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const node=entry.target as HTMLElement;if(node.hasAttribute('data-chat-presence'))presence=entry.isIntersecting?node:null;else if(entry.isIntersecting)visible.add(node);else visible.delete(node);}report();},{threshold:0.1});
  for(const node of (root.current as HTMLDivElement).querySelectorAll<HTMLElement>('[data-chat-sequence],[data-chat-presence]'))observer.observe(node);
  // RSC/new-message insertion should not require a new transcript fetch to bind visibility.
  const mutations=new MutationObserver(()=>{for(const node of (root.current as HTMLDivElement|null)?.querySelectorAll<HTMLElement>('[data-chat-sequence],[data-chat-presence]')||[])observer.observe(node);});
  mutations.observe(root.current,{childList:true,subtree:true});window.addEventListener('focus',report);window.addEventListener('blur',report);document.addEventListener('visibilitychange',report);document.addEventListener('focusin',report);
  return()=>{disposed=true;if(root.current)root.current.dataset.chatVisibleThrough='-1';observer.disconnect();mutations.disconnect();controller?.abort();clearTimeout(timer);window.removeEventListener('focus',report);window.removeEventListener('blur',report);document.removeEventListener('visibilitychange',report);document.removeEventListener('focusin',report);};
 },[endpoint,active,denied,state,update]);
 return <Context.Provider value={state}><div ref={root} className="chat-receipt-surface" data-chat-key={chatKey}>{denied?<p role="alert"><Text message="This chat is not available to you."/></p>:children}</div></Context.Provider>;
}
export function ChatMessageSeen({sequence}:{sequence:number}){
 const state=React.useContext(Context) as ChatReadState|null,seen=state&&Number.isSafeInteger(sequence)&&sequence>0&&sequence<=(state.ownSide==='CUSTOMER'?state.teamSeen:state.customerSeen);
 const Icon=seen?CheckCheck:Check;
 return <span className={`chat-message-receipt ${seen?'seen':''}`}><Icon size={13} aria-hidden="true"/><Text message={seen?'Seen':'Sent'}/></span>;
}
export function ChatTeamJoined(){const state=React.useContext(Context) as ChatReadState|null;return state?.teamJoined?<small className="chat-team-joined"><Text message="Team member joined"/></small>:null;}
