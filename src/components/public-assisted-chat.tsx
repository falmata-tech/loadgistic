'use client';

import {Headphones,MessageCircle,Paperclip,Send,ShieldCheck,X} from 'lucide-react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import React from 'react';

type Message={id:string;sender_kind:'GUEST'|'TEAM';body:string;created_at:string;attachment_id?:string|null;attachment_name?:string|null};
type Conversation={id:string;status:'WAITING'|'OPEN'|'CLOSED';assigned_agent_name?:string|null;messages:Message[];unread_team_count?:number};
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

  const refresh=React.useCallback(async(markRead:boolean)=>{
    try{
      const response=await fetch(`/api/guest-support/current?markRead=${markRead?'1':'0'}`,{cache:'no-store'});
      if(!response.ok)return;
      const result=await response.json();setConversation(result.conversation);setPresence(result.presence);
    }finally{setLoading(false);}
  },[]);

  React.useEffect(()=>{const stored=sessionStorage.getItem('loadgistic-chat-open')==='1';if(stored)setOpen(true);void refresh(stored);},[refresh]);
  React.useEffect(()=>{if(open){if(!dialog.current?.open)dialog.current?.showModal();}else if(dialog.current?.open)dialog.current.close();sessionStorage.setItem('loadgistic-chat-open',open?'1':'0');},[open]);
  React.useEffect(()=>{const interval=window.setInterval(()=>void refresh(open),open?2000:10000);return()=>window.clearInterval(interval);},[open,refresh]);

  async function submit(endpoint:string,form:FormData){
    setError('');
    const response=await fetch(endpoint,{method:'POST',body:form,headers:{accept:'application/json'}});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'The message could not be sent.');
    await refresh(true);
  }

  async function start(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);try{await submit('/api/guest-support',form);setNewSession(false);event.currentTarget.reset();}catch(caught){setError(caught instanceof Error?caught.message:'The conversation could not be started.');}}
  async function reply(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!conversation)return;const form=new FormData(event.currentTarget);try{await submit(`/api/guest-support/${conversation.id}/messages`,form);setAttachmentName('');event.currentTarget.reset();}catch(caught){setError(caught instanceof Error?caught.message:'The message could not be sent.');}}
  async function endChat(){if(!conversation)return;if(!confirmEnd){setConfirmEnd(true);return;}try{await submit(`/api/guest-support/${conversation.id}/end`,new FormData());setConfirmEnd(false);}catch(caught){setError(caught instanceof Error?caught.message:'The chat could not be ended.');}}

  if(pathname.startsWith('/help')||pathname.startsWith('/login')||pathname.startsWith('/apply'))return null;

  return <>
    <button className="public-chat-launcher" type="button" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-label={conversation?.unread_team_count?`Ask Loadgistic, ${conversation.unread_team_count} unread message${conversation.unread_team_count===1?'':'s'}`:'Ask Loadgistic'}>
      <Headphones aria-hidden="true"/><span>Ask Loadgistic</span>{conversation?.unread_team_count?<b>{conversation.unread_team_count}</b>:null}
    </button>
    <dialog ref={dialog} className="public-chat-dialog" aria-labelledby="public-chat-title" onClose={()=>setOpen(false)} onCancel={event=>{event.preventDefault();setOpen(false);}}>
      <header><div><span>{presence.available?'Team available':'Leave a message'}</span><h2 id="public-chat-title">Ask Loadgistic</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Minimize chat"><X aria-hidden="true"/></button></header>
      {loading?<div className="public-chat-loading" role="status">Opening your conversation…</div>:conversation&&!newSession?<div className="public-chat-conversation">
        <div className={`public-chat-presence ${conversation.assigned_agent_name?'online':'waiting'}`}><span aria-hidden="true"/><span>{conversation.assigned_agent_name?`${conversation.assigned_agent_name} is helping`:'Waiting for a team member'}</span>{conversation.status!=='CLOSED'?<button type="button" onClick={endChat}>{confirmEnd?'Confirm end':'End chat'}</button>:null}</div>
        <div className="public-chat-messages" aria-live="polite">{conversation.messages.map((message:Message)=><article className={message.sender_kind==='GUEST'?'mine':''} key={message.id}><strong>{message.sender_kind==='GUEST'?'You':'Loadgistic team'}</strong><p>{message.body}</p>{message.attachment_id?<a href={`/api/guest-support/${conversation.id}/attachments/${message.attachment_id}`}><Paperclip aria-hidden="true"/>{message.attachment_name}</a>:null}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time></article>)}</div>
        {conversation.status!=='CLOSED'?<form className="public-chat-composer" onSubmit={reply}><label className="sr-only" htmlFor="public-chat-reply">Reply</label><textarea id="public-chat-reply" name="body" rows={2} maxLength={2000} required placeholder="Write a reply…"/><label className="public-chat-file" title="Attach a requested file"><Paperclip aria-hidden="true"/><span>{attachmentName||'Attach file'}</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>setAttachmentName(event.target.files?.[0]?.name||'')}/></label><button type="submit" aria-label="Send reply"><Send aria-hidden="true"/><span>Send</span></button></form>:<div className="public-chat-closed"><ShieldCheck aria-hidden="true"/><span>This chat has ended. The transcript is retained for follow-up.</span><button className="button small" type="button" onClick={()=>setNewSession(true)}>Start a new chat</button></div>}
      </div>:<form className="public-chat-start" onSubmit={start}><p>Tell our team where your cargo needs to move. We use your email and phone only to continue helping if the chat disconnects.</p><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Callback phone<input name="phone" type="tel" autoComplete="tel" required/></label><label>What do you need?<textarea name="body" rows={4} maxLength={2000} required placeholder="For example: I need a cargo van from Adama to Bishoftu tomorrow."/></label><button className="button" type="submit"><MessageCircle aria-hidden="true"/>Start chat</button><Link className="public-chat-recovery" href="/help">Return with a recovery code</Link></form>}
      {error?<p className="public-chat-error" role="alert">{error}</p>:null}
    </dialog>
  </>;
}
