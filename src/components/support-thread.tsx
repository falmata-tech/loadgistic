import { CheckCircle2, Clock3, Headphones, Send, UserRound } from 'lucide-react';
import { StatusPill } from './status-pill';
import { SupportAutoScroll, SupportRefresh } from './support-refresh';

export function SupportThread({ conversation, user, canClose=false }:{
  conversation:any;
  user:any;
  canClose?:boolean;
}) {
  const open=conversation.status!=='CLOSED';
  const messageContainerId=`support-messages-${conversation.id}`;
  return <section className="support-thread" aria-label="Support conversation">
    <SupportRefresh enabled={open}/>
    <SupportAutoScroll containerId={messageContainerId} lastMessageId={conversation.messages.at(-1)?.id}/>
    <header className="support-thread-header">
      <div className="section-heading-icon"><Headphones aria-hidden="true"/><div><h2>{conversation.category.replaceAll('_',' ')}</h2><p className="meta">{conversation.assigned_agent_name?`${conversation.assigned_agent_name} is helping`:'Waiting for the next available agent'}</p></div></div>
      <StatusPill status={conversation.status}/>
    </header>
    <div className="support-messages" id={messageContainerId} aria-live="polite">
      {conversation.messages.map((message:any)=>{
        const mine=message.sender_user_id===user.id;
        const fromCustomer=message.sender_role!=='SUPPORT'&&message.sender_role!=='ADMIN';
        return <article className={`support-message ${mine?'mine':''}`} key={message.id}>
          <div className="support-message-sender">{fromCustomer?<UserRound aria-hidden="true"/>:<Headphones aria-hidden="true"/>}<strong>{mine?'You':fromCustomer?conversation.customer_name:'Loadgistic Support'}</strong></div>
          <p>{message.body}</p>
          <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
        </article>;
      })}
    </div>
    {open?<form className="support-composer" action={`/api/support/conversations/${conversation.id}/messages`} method="post">
      <label htmlFor="support-reply"><Send aria-hidden="true"/>Message</label>
      <textarea id="support-reply" name="body" maxLength={2000} rows={3} required placeholder="Type your message"/>
      <button className="button icon-button-label"><Send aria-hidden="true"/>Send</button>
    </form>:<div className="support-closed-note"><CheckCircle2 aria-hidden="true"/><span><strong>Conversation closed</strong><small>Start a new request when you need more help.</small></span></div>}
    {canClose&&open?<form className="support-close-action" action={`/api/support/conversations/${conversation.id}/close`} method="post"><button className="button secondary small"><CheckCircle2 aria-hidden="true"/>{user.role==='SUPPORT'||user.role==='ADMIN'?'Close conversation':'End chat'}</button></form>:null}
    {conversation.message_count>conversation.messages.length?<p className="support-limit-note"><Clock3 aria-hidden="true"/>Showing the latest {conversation.messages.length} messages.</p>:null}
  </section>;
}
