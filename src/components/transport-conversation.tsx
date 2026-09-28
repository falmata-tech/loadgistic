"use client";
import React from 'react';
import {Send,MessageCircle,RefreshCw,Phone} from 'lucide-react';
import {Text,useTranslation} from './localization';
import type {TransportChatSnapshot,TransportChatMessage} from '@/lib/transport-chat-contract';
import {TransportRequestFollowUp} from './transport-request-follow-up';
import {browserRequest} from '@/lib/browser-request';

type Props={endpoint:string;staff?:boolean;canReopen?:boolean;active?:boolean;initial?:TransportChatSnapshot;onNewRequest?:()=>void};
export function TransportConversation({endpoint,staff=false,canReopen=false,active=true,initial,onNewRequest}:Props){
 const {t,locale}=useTranslation();const surface=React.useRef(null as HTMLElement|null);
 React.useEffect(()=>{
  const hide=()=>{if(surface.current)surface.current.style.visibility='hidden';};
  const restore=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',restore);
  return()=>{window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',restore);};
 },[]);
 const [snapshot,setSnapshot]=React.useState(initial as TransportChatSnapshot|undefined);
 const [messages,setMessages]=React.useState((initial?.messages||[]) as TransportChatMessage[]);
 const [older,setOlder]=React.useState(initial?.hasMore||false),[loadingOlder,setLoadingOlder]=React.useState(false);
 const [draft,setDraft]=React.useState(''),[sending,setSending]=React.useState(false),[sendError,setSendError]=React.useState('');
 const [confirmEnd,setConfirmEnd]=React.useState(false),[ending,setEnding]=React.useState(false),[endError,setEndError]=React.useState('');const endingPending=React.useRef(false);
 const [offline,setOffline]=React.useState(false),[denied,setDenied]=React.useState(false),[revision,setRevision]=React.useState(0);
 const latest=React.useRef(initial?.messages.at(-1)?.sequence||0),initialized=React.useRef(Boolean(initial));
 const pending=React.useRef(false),attempt=React.useRef({body:'',id:''}),scroll=React.useRef(null as HTMLDivElement|null),stick=React.useRef(true);
 React.useEffect(()=>{
  if(!active||denied)return;
  let disposed=false,inFlight=false,failures=0,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,etag='';
  const schedule=(more=false)=>{if(!disposed&&document.visibilityState==='visible')timer=setTimeout(poll,more?100:Math.min(30000,3000*2**failures));};
  const poll=async()=>{
   if(disposed||inFlight||document.visibilityState!=='visible')return;inFlight=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);let more=false;
   try{
    const response=await fetch(`${endpoint}?after=${latest.current}`,{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
    if(response.status===401||response.status===403){if(!disposed){setDenied(true);setMessages([]);setSnapshot(undefined);}return;}
    if(response.status!==304){
     if(!response.ok)throw new Error('UNAVAILABLE');const data=await response.json() as TransportChatSnapshot|null;
     if(!data){if(!disposed){setDenied(true);setMessages([]);setSnapshot(undefined);}return;}
     if(!disposed){
      etag=response.headers.get('etag')||'';setSnapshot(data);
      if(!initialized.current){setOlder(data.hasMore);initialized.current=true;}else more=data.hasMore&&latest.current>0;
      latest.current=Math.max(latest.current,data.messages.at(-1)?.sequence||0);
      setMessages((old:TransportChatMessage[])=>{const combined=new Map(old.map(m=>[m.id,m]));for(const m of data.messages)combined.set(m.id,m);return [...combined.values()].sort((a,b)=>a.sequence-b.sequence);});
     }
    }
    failures=0;if(!disposed)setOffline(false);
   }catch{failures=Math.min(4,failures+1);if(!disposed)setOffline(true);}
   finally{clearTimeout(timeout);inFlight=false;schedule(more);}
  };
  const visibility=()=>{clearTimeout(timer);if(document.visibilityState==='visible')void poll();else controller?.abort();};
  void poll();document.addEventListener('visibilitychange',visibility);window.addEventListener('online',visibility);
  return()=>{disposed=true;controller?.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',visibility);};
 },[endpoint,active,denied,revision]);
 React.useLayoutEffect(()=>{if(stick.current&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[messages.length]);
 async function history(){
  if(loadingOlder||!messages.length)return;setLoadingOlder(true);setSendError('');stick.current=false;
  try{const {response,data}=await browserRequest<TransportChatSnapshot>(`${endpoint}?before=${messages[0].sequence}`,{cache:'no-store'});
   if(!response.ok)throw new Error();setOlder(data.hasMore);setMessages((old:TransportChatMessage[])=>{const all=new Map([...data.messages,...old].map(m=>[m.id,m]));return [...all.values()].sort((a,b)=>a.sequence-b.sequence);});
  }catch{setSendError('Could not load earlier messages. Please try again.');}finally{setLoadingOlder(false);}
 }
 async function endChat(){
  if(endingPending.current||pending.current)return;endingPending.current=true;setEnding(true);setEndError('');
  try{const {response,data}=await browserRequest<{ok:boolean;snapshot:TransportChatSnapshot}>(endpoint,{method:'PATCH'});
   if(!response.ok||!data.ok)throw new Error();setSnapshot(data.snapshot);setConfirmEnd(false);setRevision((n:number)=>n+1);
  }catch{setEndError('We could not confirm that the chat ended. Please try again.');}
  finally{endingPending.current=false;setEnding(false);}
 }
 async function send(event:React.FormEvent){
  event.preventDefault();if(pending.current||!draft.trim())return;
  const body=draft.trim();if(attempt.current.body!==body)attempt.current={body,id:crypto.randomUUID()};
  pending.current=true;setSending(true);setSendError('');
  try{const {response,data}=await browserRequest<{ok?:boolean;error?:string}>(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId:attempt.current.id,body})});
   if(!response.ok||!data.ok)throw new Error(data.error||'Message not confirmed. Your draft is kept; try sending again.');
   setDraft('');attempt.current={body:'',id:''};stick.current=true;setRevision((n:number)=>n+1);
  }catch(error){setSendError(error instanceof Error&&error.message!=='REQUEST_TIMEOUT'?error.message:'Message not confirmed. Your draft is kept; try sending again.');}
  finally{pending.current=false;setSending(false);}
 }
 if(denied)return <section className="transport-chat-recovery" role="status"><p><Text message="This conversation is no longer available in this browser."/></p>{!staff?<p><Text message="Our team still has your request and phone number for follow-up."/></p>:null}{onNewRequest?<button className="button secondary" onClick={onNewRequest}><Text message="Request another route"/></button>:null}</section>;
 if(!snapshot)return <p role="status"><Text message={offline?'Conversation updates are temporarily unavailable. Retrying…':'Opening conversation…'}/></p>;
 const closed=snapshot.request.status==='CLOSED',ended=Boolean(snapshot.request.endedAt)||Date.parse(snapshot.request.expiresAt)<=Date.now(),canMessage=!closed&&!ended;
 return <section ref={surface} className="transport-conversation" aria-label={t('Brokerage conversation')}>
  <header><MessageCircle aria-hidden="true"/><div><strong>{snapshot.request.origin} → {snapshot.request.destination}</strong><small><Text message="Request reference"/>: {snapshot.request.id.slice(0,8).toUpperCase()}</small></div></header>
  <p className="transport-chat-state" role="status">{closed?<Text message="Conversation closed"/>:ended?<Text message="Chat ended"/>:snapshot.request.assignedName?<><Text message="Assigned to"/> {snapshot.request.assignedName}</>:<Text message="Waiting for brokerage"/>}</p>
  {!staff&&canMessage?<p className="transport-chat-guidance"><Text message="Replies appear here automatically. You can return to this chat in the same browser for 7 days."/></p>:null}
  {ended&&!closed?<p className="transport-chat-guidance"><Text message={staff?'Chat ended · call to follow up':'This chat has ended. Our team can still call you.'}/></p>:null}
  {staff&&snapshot.staffDetails?<div className="transport-chat-contact"><strong>{snapshot.staffDetails.name}</strong><a className="button secondary" href={`tel:${snapshot.staffDetails.phone}`}><Phone aria-hidden="true"/>{snapshot.staffDetails.phone}</a></div>:null}
  {offline?<p className="form-notice" role="status"><RefreshCw aria-hidden="true"/><Text message="Connection interrupted. Reconnecting…"/></p>:null}
  <div className="transport-chat-messages" ref={scroll} onScroll={()=>{const el=scroll.current;if(el)stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;}} role="log" aria-label={t('Conversation messages')} aria-live="polite" aria-relevant="additions">
   {older?<button className="text-button" onClick={history} disabled={loadingOlder}><Text message={loadingOlder?'Loading…':'Earlier messages'}/></button>:null}
   {!messages.length&&canMessage?<div className="transport-chat-empty"><MessageCircle aria-hidden="true"/><strong><Text message={staff?"Start the conversation":"What are you moving?"}/></strong><p><Text message={staff?"Introduce yourself and help the customer arrange their transport.":"Tell us about your goods and when you need pickup. We’ll help you work out the next step."}/></p></div>:null}
   {messages.map((message:TransportChatMessage)=><article key={message.id} className={`transport-chat-message ${message.sender_kind==='BROKER'?'from-broker':'from-customer'}`} data-message-id={message.id}><strong>{message.sender_kind==='BROKER'?(message.sender_name||t('Transport team')):t(staff?'Customer':'You')}</strong><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}</time></article>)}
  </div>
  {sendError?<p className="form-error" role="alert">{t(sendError)}</p>:null}
  {canMessage?<form className="transport-chat-composer" onSubmit={send}><label><Text message="Message"/><textarea value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} rows={2} placeholder={t(staff?"Write a reply…":"Your goods, pickup time, or a question…")} required disabled={sending||ending}/></label><button className="button" disabled={sending||ending||!draft.trim()}><Send aria-hidden="true"/><Text message={sending?'Sending…':'Send message'}/></button></form>:onNewRequest?<button className="button secondary" onClick={onNewRequest}><Text message="Start a new chat"/></button>:null}
  {canMessage&&!staff?<div className="transport-chat-ending">{confirmEnd?<section aria-label={t('End this chat?')} className="transport-chat-end-confirm"><strong><Text message="End this chat?"/></strong><p><Text message="Messages will stop, but our team can still call you about this request."/></p><div><button type="button" className="button secondary" disabled={ending} onClick={()=>{setConfirmEnd(false);setEndError('');}}><Text message="Keep chatting"/></button><button type="button" className="button" disabled={ending||sending} onClick={endChat}><Text message={ending?'Ending chat…':'End chat'}/></button></div>{endError?<p role="alert" className="form-error">{t(endError)}</p>:null}</section>:<button type="button" className="text-button" disabled={sending} onClick={()=>setConfirmEnd(true)}><Text message="End chat"/></button>}</div>:null}
  {staff&&snapshot.staffDetails?<details className="transport-chat-follow-up" open={!canMessage}><summary><Text message="Request follow-up"/></summary><TransportRequestFollowUp canReopen={canReopen} request={{id:snapshot.request.id,status:snapshot.request.status,version:snapshot.staffDetails.version,follow_up_note:snapshot.staffDetails.followUpNote}}/></details>:null}
 </section>;
}
