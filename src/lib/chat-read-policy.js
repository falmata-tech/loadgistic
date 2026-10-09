const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function chatReadInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||
  !Number.isSafeInteger(value.throughSequence)||value.throughSequence<0||
  !Number.isSafeInteger(value.assignmentVersion)||value.assignmentVersion<0)throw Error('INVALID_CHAT_READ');
 return {throughSequence:value.throughSequence,assignmentVersion:value.assignmentVersion};
}
export function chatConversationId(value){if(typeof value!=='string'||!uuid.test(value))throw Error('FORBIDDEN');return value;}
export function chatReadState(value){
 if(!value||!['CUSTOMER','TEAM'].includes(value.ownSide)||typeof value.teamJoined!=='boolean'||
  !['customerSeen','teamSeen','ownSeen','latestSequence','unreadCount','assignmentVersion'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0)||
  value.customerSeen>value.latestSequence||value.teamSeen>value.latestSequence||value.ownSeen>value.latestSequence||
  value.joinedAt!==null&&typeof value.joinedAt!=='string')throw Error('CHAT_READ_UNAVAILABLE');
 return {customerSeen:value.customerSeen,teamSeen:value.teamSeen,ownSeen:value.ownSeen,latestSequence:value.latestSequence,ownSide:value.ownSide,unreadCount:value.unreadCount,teamJoined:value.teamJoined,joinedAt:value.joinedAt,assignmentVersion:value.assignmentVersion};
}
export function chatAlertSnapshot(value){
 if(!value||!Number.isSafeInteger(value.unreadCount)||value.unreadCount<0||!Number.isSafeInteger(value.waitingCount)||value.waitingCount<0||!Array.isArray(value.items)||value.items.length>40)throw Error('CHAT_ALERTS_UNAVAILABLE');
 for(const item of value.items){
  if(!item||!['SUPPORT','BROKERAGE'].includes(item.kind)||!uuid.test(item.id)||!['CUSTOMER','TEAM'].includes(item.side)||
   !['assignmentVersion','unreadCount','incomingSequence'].every(key=>Number.isSafeInteger(item[key])&&item[key]>=0)||
   !['queued','assigned','teamJoined','chatEnabled'].every(key=>typeof item[key]==='boolean')||
   typeof item.status!=='string'||typeof item.updatedAt!=='string'||item.assignedName!==null&&typeof item.assignedName!=='string'||
   item.endedAt!==null&&typeof item.endedAt!=='string')throw Error('CHAT_ALERTS_UNAVAILABLE');
 }
 return {unreadCount:value.unreadCount,waitingCount:value.waitingCount,items:value.items.map(item=>({kind:item.kind,id:item.id,status:item.status,side:item.side,queued:item.queued,assigned:item.assigned,assignedName:item.assignedName,assignmentVersion:item.assignmentVersion,teamJoined:item.teamJoined,unreadCount:item.unreadCount,incomingSequence:item.incomingSequence,endedAt:item.endedAt,chatEnabled:item.chatEnabled,updatedAt:item.updatedAt}))};
}
// Notification presentation is separate from the saved unread/read authority.
export function chatAlertChanges(previous,next){
 chatAlertSnapshot(next);if(!previous)return [];
 const prior=new Map(previous.items.map(item=>[item.kind+':'+item.id,item])),changes=[];
 for(const item of next.items){const old=prior.get(item.kind+':'+item.id);
  if(item.status==='CLOSED'){if(old&&old.status!=='CLOSED')changes.push({item,event:'RESOLVED'});continue;}
  if(item.queued){if(!old||!old.queued||old.assignmentVersion!==item.assignmentVersion)changes.push({item,event:'QUEUED'});continue;}
  if(item.unreadCount>0&&(!old||item.incomingSequence>old.incomingSequence))changes.push({item,event:'MESSAGE'});
  if(item.side==='CUSTOMER'&&item.assigned&&(!old||!old.assigned||old.assignmentVersion!==item.assignmentVersion))changes.push({item,event:'ASSIGNED'});
  if(item.side==='CUSTOMER'&&item.teamJoined&&(!old||!old.teamJoined||old.assignmentVersion!==item.assignmentVersion))changes.push({item,event:'JOINED'});
  if(item.side==='TEAM'&&item.assigned&&(!old||old.queued||old.assignmentVersion!==item.assignmentVersion))changes.push({item,event:'ASSIGNED'});
  if(item.endedAt&&old&&!old.endedAt)changes.push({item,event:'ENDED'});
 }
 return changes;
}
export function chatAlertHref(item){
 if(item.kind==='SUPPORT')return item.side==='CUSTOMER'?`/app/support?conversation=${chatConversationId(item.id)}`:item.queued?'/support?view=WAITING':`/support/${chatConversationId(item.id)}`;
 return item.side==='CUSTOMER'?'#transport-chat':item.queued||!item.chatEnabled?'/brokerage?queue=UNASSIGNED':`/brokerage/${chatConversationId(item.id)}`;
}
export function mergeChatReadState(previous,next){
 chatReadState(next);if(!previous)return next;
 if(next.assignmentVersion<previous.assignmentVersion)return previous;
 if(next.assignmentVersion===previous.assignmentVersion&&(
  next.latestSequence<previous.latestSequence||next.customerSeen<previous.customerSeen||next.teamSeen<previous.teamSeen||next.ownSeen<previous.ownSeen
 ))return previous;
 return next;
}
export function visibleChatSequence({active,focused,offset,height,messages}){
 if(!active||!focused||!Number.isFinite(offset)||!Number.isFinite(height)||height<=0)return null;
 let latest=null;
 for(const item of messages){if(Number.isSafeInteger(item.sequence)&&item.sequence>0&&Number.isFinite(item.top)&&Number.isFinite(item.height)&&item.height>0&&item.top<offset+height&&item.top+item.height>offset)latest=Math.max(latest||0,item.sequence);}
 return latest;
}
