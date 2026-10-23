/** A cursor identifies a message, never an offset or an authorization grant. */
export function supportHistoryCursor(value){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new Error('INVALID_SUPPORT_CURSOR');
  return value;
}

export function supportMessageWindow(conversation){
  if(!conversation)return conversation;
  if('history_before' in conversation)return conversation;
  const messages=conversation.messages||[];
  const hasOlder=Number(conversation.message_count)>messages.length;
  return {...conversation,history_before:null,has_older:hasOlder,next_before:hasOlder?messages[0]?.id||null:null};
}

export function supportHistoryHref(basePath,before=null){
  const [pathname,query='']=basePath.split('?');
  const params=new URLSearchParams(query);
  params.delete('before');
  if(before)params.set('before',supportHistoryCursor(before));
  return `${pathname}${params.size?`?${params}`:''}`;
}
