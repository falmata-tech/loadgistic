import {chatAlertChanges} from './chat-read-policy.js';
// Bounded, session-only delivery memory. It contains IDs/counters, never messages.
// A reload establishes a baseline rather than sounding for old work.
export function createChatAlertTracker(){
 let previous=null,watermark=0;const delivered=new Set(),known=new Set();
 return {reset(){previous=null;watermark=0;delivered.clear();known.clear();},next(snapshot){
  const changes=chatAlertChanges(previous,snapshot).filter(change=>known.has(change.item.kind+':'+change.item.id)||Date.parse(change.item.updatedAt)>watermark);previous=snapshot;
  for(const item of snapshot.items){known.add(item.kind+':'+item.id);watermark=Math.max(watermark,Date.parse(item.updatedAt)||0);if(known.size>200)known.delete(known.values().next().value);}
  return changes.filter(change=>{const {item,event}=change,key=[item.kind,item.id,event,item.assignmentVersion,event==='MESSAGE'?item.incomingSequence:event==='ENDED'?item.endedAt:''].join(':');
   if(delivered.has(key))return false;delivered.add(key);if(delivered.size>200)delivered.delete(delivered.values().next().value);return true;
  });
 }};
}
export function chatAlertCopy(change){
 const {item,event}=change;
 if(event==='QUEUED')return item.kind==='SUPPORT'?'New support chat waiting':'New transport request waiting';
 if(event==='ASSIGNED')return item.side==='TEAM'?'A chat was assigned to you':'A team member is assigned';
 if(event==='JOINED')return 'A team member joined your chat';
 if(event==='ENDED')return 'Chat ended · follow-up is still available';
 if(event==='RESOLVED')return 'Your request was resolved';
 return 'New unread message';
}
