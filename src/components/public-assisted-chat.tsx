'use client';

import {Headphones,MessageCircle,Paperclip,Send,ShieldCheck,X} from 'lucide-react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import React from 'react';
import {SurfaceSkeleton} from './loading-state';
import {guestChatRefreshDelay} from '@/lib/guest-chat-refresh.js';

type Message={id:string;sender_kind:'GUEST'|'TEAM';body:string;created_at:string;attachment_id?:string|null;attachment_name?:string|null};
type Conversation={id:string;status:'WAITING'|'OPEN'|'CLOSED';assigned_agent_name?:string|null;messages:Message[];unread_team_count?:number;has_older?:boolean;next_before?:string|null;history_before?:string|null};
type Presence={available:boolean;availableTeamMembers:number};

export function PublicAssistedChat(){
  const dialog=React.useRef(null as HTMLDialogElement|null);
  const pathname=usePathname();
  const [open,setOpen]=React.useState(false);
  const [conversation,setConversation]=React.useState(null as Conversation|null);
  const [presence,setPresence]=React.useState({available:false,availableTeamMembers:0} as Presence);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState('');
  const [newSession,setNewSession]=React.useState(false);
  const [confirmEnd,setConfirmEnd]=React.useState(false);
  const [attachmentName,setAttachmentName]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [refreshError,setRefreshError]=React.useState('');
  const submitting=React.useRef(false);
  const refreshing=React.useRef(null as Promise<boolean>|null);
  const historyBefore=React.useRef('');
  const revision=React.useRef('');
  const [historyRevision,setHistoryRevision]=React.useState(0);
  const enabled=!pathname.startsWith('/help')&&!pathname.startsWith('/login')&&!pathname.startsWith('/apply');

  const refresh=React.useCallback((markRead:boolean):Promise<boolean>=>{
    if(refreshing.current)return refreshing.current;
    const request=(async()=>{
      try{
        const response=await fetch(`/api/guest-support/current?markRead=${markRead&&!historyBefore.current?'1':'0'}${historyBefore.current?`&before=${encodeURIComponent(historyBefore.current)}`:''}`,{cache:'no-store',headers:revision.current?{'If-None-Match':revision.current}:{}});
        if(response.status===304){setRefreshError('');return true;}
        if(!response.ok)throw new Error('REFRESH_FAILED');
        const result=await response.json();revision.current=response.headers.get('etag')||'';setConversation(result.conversation);setPresence(result.presence);setRefreshError('');
        return true;
      }catch{
        setRefreshError('Conversation updates are unavailable. Check your connection and retry.');return false;
      }finally{setLoading(false);refreshing.current=null;}
    })();
    refreshing.current=request;
    return request;
  },[]);

  React.useEffect(()=>{if(sessionStorage.getItem('loadgistic-chat-open')==='1')setOpen(true);},[]);
  React.useEffect(()=>{if(!enabled)return;if(open){if(!dialog.current?.open)dialog.current?.showModal();}else if(dialog.current?.open)dialog.current.close();sessionStorage.setItem('loadgistic-chat-open',open?'1':'0');},[open,enabled]);
  React.useEffect(()=>{
    if(!enabled)return;
    if(document.visibilityState==='visible')void refresh(open);
  },[enabled,open,refresh]);
  React.useEffect(()=>{
    let timer:number|undefined,disposed=false,failures=0,generation=0;
    const schedule=(version=generation)=>{
      if(disposed||version!==generation)return;
      if(historyBefore.current)return;
      const delay=guestChatRefreshDelay({visible:document.visibilityState==='visible',enabled,open,status:conversation?.status});
      if(delay===null)return;
      timer=window.setTimeout(async()=>{
        if(!submitting.current){const ok=await refresh(open);failures=ok?0:Math.min(4,failures+1);}
        schedule(version);
      },Math.min(30000,delay*2**failures));
    };
    const visibilityChanged=()=>{generation+=1;window.clearTimeout(timer);if(!historyBefore.current&&document.visibilityState==='visible'&&enabled&&(open||conversation?.status==='OPEN'||conversation?.status==='WAITING'))void refresh(open);schedule();};
    schedule();document.addEventListener('visibilitychange',visibilityChanged);
    return()=>{disposed=true;window.clearTimeout(timer);document.removeEventListener('visibilitychange',visibilityChanged);};
  },[enabled,open,conversation?.status,conversation?.history_before,historyRevision,refresh]);

  async function submit(endpoint:string,form:FormData){
    setError('');
    const response=await fetch(endpoint,{method:'POST',body:form,headers:{accept:'application/json'}});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'The message could not be sent.');
    // Finish a pre-submit read before requesting the saved state.
    if(refreshing.current)await refreshing.current;
    historyBefore.current='';revision.current='';
    if(!await refresh(true))setRefreshError('Saved. Conversation updates are unavailable; retry to see the latest messages.');
  }

  async function perform(action:()=>Promise<void>){
    if(submitting.current)return;
    submitting.current=true;setBusy(true);
    try{await action();}catch(caught){setError(caught instanceof Error?caught.message:'The action could not be completed.');}
    finally{submitting.current=false;setBusy(false);}
  }
  async function start(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const element=event.currentTarget;const form=new FormData(element);await perform(async()=>{await submit('/api/guest-support',form);setNewSession(false);element.reset();});}
  async function reply(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!conversation)return;const element=event.currentTarget;const form=new FormData(element);await perform(async()=>{await submit(`/api/guest-support/${conversation.id}/messages`,form);setAttachmentName('');element.reset();});}
  async function endChat(){if(!conversation)return;if(!confirmEnd){setConfirmEnd(true);return;}await perform(async()=>{await submit(`/api/guest-support/${conversation.id}/end`,new FormData());setConfirmEnd(false);});}

  async function showHistory(before:string){
    await perform(async()=>{
      if(refreshing.current)await refreshing.current;
      const prior=historyBefore.current;historyBefore.current=before;revision.current='';
      const loaded=await refresh(!before);
      if(!loaded)historyBefore.current=prior;
      setHistoryRevision((value:number)=>value+1);
      if(!loaded)return;
      const messages=dialog.current?.querySelector('.public-chat-messages');
      if(messages)messages.scrollTop=0;
    });
  }

  if(!enabled)return null;

  return <>
    <button className="public-chat-launcher" type="button" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-label={conversation?.unread_team_count?`Ask Loadgistic, ${conversation.unread_team_count} unread message${conversation.unread_team_count===1?'':'s'}`:'Ask Loadgistic'}>
      <Headphones aria-hidden="true"/><span>Ask Loadgistic</span>{conversation?.unread_team_count?<b>{conversation.unread_team_count}</b>:null}
    </button>
    <dialog ref={dialog} className="public-chat-dialog" aria-labelledby="public-chat-title" onClose={()=>setOpen(false)} onCancel={event=>{event.preventDefault();setOpen(false);}}>
      <header><div><span>{presence.available?'Team available':'Leave a message'}</span><h2 id="public-chat-title">Ask Loadgistic</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Minimize chat"><X aria-hidden="true"/></button></header>
      {loading?<SurfaceSkeleton kind="chat" className="public-chat-loading" label="Opening your conversation"/>:conversation&&!newSession?<div className="public-chat-conversation">
        <div className={`public-chat-presence ${conversation.assigned_agent_name?'online':'waiting'}`}><span aria-hidden="true"/><span>{conversation.assigned_agent_name?`${conversation.assigned_agent_name} is helping`:'Waiting for a team member'}</span>{conversation.status!=='CLOSED'?<button type="button" onClick={endChat}>{confirmEnd?'Confirm end':'End chat'}</button>:null}</div>
        {conversation.has_older||conversation.history_before?<nav className="support-history-nav" aria-label="Message history">
          {conversation.has_older?<button className="button secondary small" type="button" disabled={busy} onClick={()=>void showHistory(conversation.next_before||'')}>Older messages</button>:<span>Beginning of conversation</span>}
          {conversation.history_before?<button className="button secondary small" type="button" disabled={busy} onClick={()=>void showHistory('')}>Latest messages</button>:null}
          {conversation.history_before?<small>Earlier messages · updates paused</small>:null}
        </nav>:null}
        <div className="public-chat-messages" aria-live="polite">{conversation.messages.map((message:Message)=><article className={message.sender_kind==='GUEST'?'mine':''} key={message.id}><strong>{message.sender_kind==='GUEST'?'You':'Loadgistic team'}</strong><p>{message.body}</p>{message.attachment_id?<a href={`/api/guest-support/${conversation.id}/attachments/${message.attachment_id}`}><Paperclip aria-hidden="true"/>{message.attachment_name}</a>:null}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time></article>)}</div>
        {conversation.status!=='CLOSED'?<form className="public-chat-composer" onSubmit={reply}><label className="sr-only" htmlFor="public-chat-reply">Reply</label><textarea id="public-chat-reply" name="body" rows={2} maxLength={2000} required placeholder="Write a reply…"/><label className="public-chat-file" title="Attach a requested file"><Paperclip aria-hidden="true"/><span>{attachmentName||'Attach file'}</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>setAttachmentName(event.target.files?.[0]?.name||'')}/></label><button type="submit" aria-label="Send reply"><Send aria-hidden="true"/><span>Send</span></button></form>:<div className="public-chat-closed"><ShieldCheck aria-hidden="true"/><span>This chat has ended. The transcript is retained for follow-up.</span><button className="button small" type="button" onClick={()=>setNewSession(true)}>Start a new chat</button></div>}
      </div>:<form className="public-chat-start" onSubmit={start}><p>Tell our team where your cargo needs to move. We use your email and phone only to continue helping if the chat disconnects.</p><label>Email<input disabled={busy} name="email" type="email" autoComplete="email" required/></label><label>Callback phone<input disabled={busy} name="phone" type="tel" autoComplete="tel" required/></label><label>What do you need?<textarea disabled={busy} name="body" rows={4} maxLength={2000} required placeholder="For example: I need a cargo van from Adama to Bishoftu tomorrow."/></label><button className="button" type="submit" disabled={busy}><MessageCircle aria-hidden="true"/>Start chat</button><Link className="public-chat-recovery" href="/help">Return with a recovery code</Link></form>}
      {error?<p className="public-chat-error" role="alert">{error}</p>:null}
      {refreshError?<p className="public-chat-error" role="status">{refreshError} <button type="button" disabled={busy} onClick={()=>void refresh(open)}>Retry updates</button></p>:null}
    </dialog>
  </>;
}
