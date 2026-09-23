
import {Localized,Text} from '@/components/localization';
import { CheckCircle2, Headphones, Paperclip, Send, UserRound } from 'lucide-react';
import { StatusPill } from './status-pill';
import { SupportAutoScroll, SupportRefresh } from './support-refresh';
import {SupportHistoryNav} from './support-history-nav';

export function SupportThread({ conversation, user, canClose=false }:{
  conversation:any;
  user:any;
  canClose?:boolean;
}) {
  const open=conversation.status!=='CLOSED';
  const messageContainerId=`support-messages-${conversation.id}`;
  return <Localized as="section" copy={["aria-label"]} className="support-thread" aria-label="Support conversation">
    <SupportRefresh endpoint={`/api/support/updates?conversation=${conversation.id}`} enabled={open&&!conversation.history_before}/>
    <SupportAutoScroll containerId={messageContainerId} lastMessageId={conversation.messages.at(-1)?.id} atStart={Boolean(conversation.history_before)}/>
    <header className="support-thread-header">
      <div className="section-heading-icon"><Headphones aria-hidden="true"/><div><h2>{conversation.category.replaceAll('_',' ')}</h2><p className="meta">{conversation.assigned_agent_name?`${conversation.assigned_agent_name} is helping`:<Text message="Waiting for the next available agent"/>}</p></div></div>
      <StatusPill status={conversation.status}/>
    </header>
    <SupportHistoryNav conversation={conversation} basePath={user.role==='SUPPORT'||user.role==='ADMIN'?`/support/${conversation.id}`:`/app/support?conversation=${conversation.id}`}/>
    <div className="support-messages" id={messageContainerId} aria-live="polite">
      {conversation.messages.map((message:any)=>{
        const mine=message.sender_user_id===user.id;
        const fromCustomer=message.sender_role!=='SUPPORT'&&message.sender_role!=='ADMIN';
        return <article className={`support-message ${mine?'mine':''}`} key={message.id}>
          <div className="support-message-sender">{fromCustomer?<UserRound aria-hidden="true"/>:<Headphones aria-hidden="true"/>}<strong>{mine?<Text message="You"/>:fromCustomer?conversation.customer_name:<Text message="Loadgistic Support"/>}</strong></div>
          <p>{message.body}</p>
          {message.attachment_id?<a className="support-attachment" href={`/api/support/conversations/${conversation.id}/attachments/${message.attachment_id}`}><Paperclip aria-hidden="true"/>{message.attachment_name}</a>:null}
          <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
        </article>;
      })}
    </div>
    {open?<form className="support-composer" encType="multipart/form-data" action={`/api/support/conversations/${conversation.id}/messages`} method="post">
      <label htmlFor="support-reply"><Send aria-hidden="true"/><Text message="Message"/></label>
      <Localized as="textarea" copy={["placeholder"]} id="support-reply" name="body" maxLength={2000} rows={3} required placeholder="Type your message"/>
      <label className="support-file-field"><Paperclip aria-hidden="true"/><span><Text message="Attachment "/><small><Text message="(optional JPG, PNG, WebP or PDF, up to 4 MB)"/></small></span><input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></label>
      <button className="button icon-button-label"><Send aria-hidden="true"/><Text message="Send"/></button>
    </form>:<div className="support-closed-note"><CheckCircle2 aria-hidden="true"/><span><strong><Text message="Conversation closed"/></strong><small><Text message="Start a new request when you need more help."/></small></span></div>}
    {canClose&&open?<form className="support-close-action" action={`/api/support/conversations/${conversation.id}/close`} method="post"><button className="button secondary small"><CheckCircle2 aria-hidden="true"/>{user.role==='SUPPORT'||user.role==='ADMIN'?<Text message="Close conversation"/>:<Text message="End chat"/>}</button></form>:null}
  </Localized>;
}
