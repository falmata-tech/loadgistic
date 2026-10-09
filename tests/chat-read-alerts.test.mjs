import test from 'node:test';
import assert from 'node:assert/strict';
import {chatReadInput,chatConversationId,chatReadState,chatAlertSnapshot,chatAlertChanges,chatAlertHref,mergeChatReadState,visibleChatSequence} from '../src/lib/chat-read-policy.js';
import {createChatAlertTracker,chatAlertCopy} from '../src/lib/chat-alert-delivery.js';
const id='11111111-1111-4111-8111-111111111111';
const item={kind:'BROKERAGE',id,status:'NEW',side:'CUSTOMER',queued:false,assigned:false,assignedName:null,assignmentVersion:0,teamJoined:false,unreadCount:0,incomingSequence:0,endedAt:null,chatEnabled:true,updatedAt:'2026-10-07T20:00:00Z'};
const feed=(patch={})=>({unreadCount:patch.unreadCount||0,waitingCount:0,items:[{...item,...patch}]});
const read={customerSeen:0,teamSeen:0,ownSeen:0,latestSequence:2,ownSide:'CUSTOMER',unreadCount:1,teamJoined:false,joinedAt:null,assignmentVersion:0};
test('acknowledgement is only a bounded cursor and assignment frame, never claimed identity',()=>{
 assert.deepEqual(chatReadInput({throughSequence:0,assignmentVersion:0}),{throughSequence:0,assignmentVersion:0});
 for(const input of [null,[],{throughSequence:2},{throughSequence:2,assignmentVersion:0,actorId:id},{throughSequence:-1,assignmentVersion:0},{throughSequence:2,assignmentVersion:0.5},{throughSequence:'2',assignmentVersion:0},{throughSequence:Number.MAX_SAFE_INTEGER+1,assignmentVersion:0}])assert.throws(()=>chatReadInput(input),/INVALID_CHAT_READ/);
 assert.equal(chatConversationId(id),id);assert.throws(()=>chatConversationId('../another-chat'),/FORBIDDEN/);
});
test('read and alert projections strip unexpected private fields and reject invented counters',()=>{
 assert.equal('body' in chatReadState({...read,body:'Private content'}),false);
 assert.throws(()=>chatReadState({...read,ownSeen:3}),/UNAVAILABLE/);
 assert.throws(()=>chatReadState({...read,teamSeen:-1}),/UNAVAILABLE/);
 const value=chatAlertSnapshot({...feed(),phone:'+251900000000',items:[{...item,body:'Private note',digest:'secret'}]});
 assert.equal('phone' in value,false);assert.equal('body' in value.items[0],false);assert.equal('digest' in value.items[0],false);
 assert.throws(()=>chatAlertSnapshot({...feed(),items:Array(41).fill(item)}),/UNAVAILABLE/);
});
test('initial snapshots and read-only changes never ring; actual new unread replies do',()=>{
 assert.deepEqual(chatAlertChanges(null,feed({unreadCount:5,incomingSequence:9})),[]);
 assert.deepEqual(chatAlertChanges(feed({unreadCount:5,incomingSequence:9}),feed({unreadCount:0,incomingSequence:9})),[]);
 assert.deepEqual(chatAlertChanges(feed(),feed({unreadCount:1,incomingSequence:3})).map(e=>e.event),['MESSAGE']);
 assert.deepEqual(chatAlertChanges(feed({unreadCount:1,incomingSequence:3}),feed({unreadCount:1,incomingSequence:3})),[]);
});
test('assignment, actual join and handoff remain different alert events',()=>{
 const assigned=feed({assigned:true,assignedName:'Untranslated name',assignmentVersion:1});
 assert.deepEqual(chatAlertChanges(feed(),assigned).map(e=>e.event),['ASSIGNED']);
 const joined=feed({assigned:true,assignmentVersion:1,teamJoined:true});
 assert.deepEqual(chatAlertChanges(assigned,joined).map(e=>e.event),['JOINED']);
 const next=feed({assigned:true,assignmentVersion:2,teamJoined:false});
 assert.deepEqual(chatAlertChanges(joined,next).map(e=>e.event),['ASSIGNED']);
 const worker={...item,side:'TEAM'};
 assert.deepEqual(chatAlertChanges({unreadCount:0,waitingCount:0,items:[]},{unreadCount:0,waitingCount:0,items:[{...worker,assigned:true,assignmentVersion:1}]}).map(e=>e.event),['ASSIGNED']);
});
test('waiting, ended and resolved work has its own notification without restoring public Help',()=>{
 assert.deepEqual(chatAlertChanges(feed(),feed({side:'TEAM',queued:true})).map(e=>e.event),['QUEUED']);
 assert.deepEqual(chatAlertChanges(feed(),feed({endedAt:'2026-10-07T21:00:00Z'})).map(e=>e.event),['ENDED']);
 assert.deepEqual(chatAlertChanges(feed(),feed({status:'CLOSED',teamJoined:true})).map(e=>e.event),['RESOLVED']);
 assert.equal(chatAlertHref({...item,side:'TEAM',queued:true}),'/brokerage?queue=UNASSIGNED');
 assert.equal(chatAlertHref({...item,kind:'SUPPORT',side:'CUSTOMER'}),`/app/support?conversation=${id}`);
});
test('only visible messages in an active focused chat can advance a read cursor',()=>{
 const input={active:true,focused:true,offset:100,height:200,messages:[{sequence:1,top:0,height:50},{sequence:2,top:150,height:50},{sequence:3,top:350,height:50}]};
 assert.equal(visibleChatSequence(input),2);
 assert.equal(visibleChatSequence({...input,active:false}),null);assert.equal(visibleChatSequence({...input,focused:false}),null);
 assert.equal(visibleChatSequence({...input,offset:320}),3);assert.equal(visibleChatSequence({...input,height:0}),null);
});
test('late snapshots cannot regress Seen or restore an earlier agent join',()=>{
 const seen={...read,ownSeen:2,customerSeen:2,unreadCount:0};
 assert.equal(mergeChatReadState(seen,read),seen);
 const handoff={...seen,ownSide:'TEAM',ownSeen:0,assignmentVersion:1,teamJoined:false};
 assert.equal(mergeChatReadState(seen,handoff),handoff);
 assert.equal(mergeChatReadState(handoff,{...seen,teamJoined:true}),handoff);
});
test('delivery coalesces replayed events without marking messages read or exposing content',()=>{
 const tracker=createChatAlertTracker();assert.deepEqual(tracker.next(feed()),[]);
 const next=feed({unreadCount:1,incomingSequence:3});assert.equal(tracker.next(next).length,1);assert.deepEqual(tracker.next(next),[]);
 tracker.next(feed());assert.deepEqual(tracker.next(next),[],'A delayed/replayed snapshot must not ring again');
 assert.equal(chatAlertCopy({item:{...item,body:'private',phone:'private'},event:'MESSAGE'}),'New unread message');
 assert.equal(tracker.next(feed({unreadCount:2,incomingSequence:4})).length,1);
 tracker.reset();assert.deepEqual(tracker.next(next),[],'Restart establishes a silent baseline');
});
test('older work appearing after the bounded feed changes is not announced as a new chat',()=>{
 const tracker=createChatAlertTracker();tracker.next(feed());
 const older={...item,id:'22222222-2222-4222-8222-222222222222',side:'TEAM',queued:true,updatedAt:'2026-10-06T20:00:00Z'};
 assert.deepEqual(tracker.next({unreadCount:0,waitingCount:1,items:[older]}),[]);
 const fresh={...older,id:'33333333-3333-4333-8333-333333333333',updatedAt:'2026-10-08T20:00:00Z'};
 assert.equal(tracker.next({unreadCount:0,waitingCount:2,items:[older,fresh]}).length,1);
});
