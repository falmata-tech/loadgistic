
import {Localized,Text} from '@/components/localization';
import Link from 'next/link';
import {ArrowUp,MessagesSquare} from 'lucide-react';
import {supportHistoryHref} from '@/lib/support-history.js';

export function SupportHistoryNav({conversation,basePath}:{conversation:any;basePath:string}){
  if(!conversation.has_older&&!conversation.history_before)return null;
  return <Localized as="nav" copy={["aria-label"]} className="support-history-nav" aria-label="Message history">
    {conversation.has_older?<Link className="button secondary small" href={supportHistoryHref(basePath,conversation.next_before)}><ArrowUp aria-hidden="true"/><Text message="Older messages"/></Link>:<span><Text message="Beginning of conversation"/></span>}
    {conversation.history_before?<Link className="button secondary small" href={supportHistoryHref(basePath)}><MessagesSquare aria-hidden="true"/><Text message="Latest messages"/></Link>:null}
    <small>{conversation.history_before?<Text message="Earlier messages · updates paused"/>:`Latest ${conversation.messages.length} messages`}</small>
  </Localized>;
}
