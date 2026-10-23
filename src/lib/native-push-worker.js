import {nativePushMessage,nativePushOutcome} from './native-push-policy.js';
// Ports are bounded RPC operations and fixed-provider HTTP, never client snapshots.
async function limited(values,limit,run){let next=0;const results=[];await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{while(next<values.length){const index=next++;results[index]=await run(values[index]);}}));return results;}
export async function processNativePushBatch({workerId,store,provider,translate=(_locale,text)=>text}){
 const stats={claimed:0,sent:0,receipts:0,cancelled:0,failed:0};
 const claimed=await store.claim(workerId,40);stats.claimed=claimed.length;
 const contexts=(await limited(claimed,4,async item=>{try{return await store.context(item.id,workerId);}catch{stats.failed++;return null;}})).filter(Boolean);stats.cancelled=claimed.length-contexts.length-stats.failed;
 const sends=contexts.filter(item=>item.state==='SENDING'),receipts=contexts.filter(item=>item.state==='CHECKING');
 const complete=async(rows,results)=>limited(rows,4,async(item,index)=>{
  const result=results.get(item.id)||{code:'RETRY'};try{const saved=await store.finish(item.id,workerId,result);if(!saved){stats.cancelled++;return;}if(result.code==='ACCEPTED')stats.sent++;else if(result.code==='DELIVERED')stats.receipts++;else if(!['RETRY','NO_RECEIPT'].includes(result.code))stats.failed++;}catch{stats.failed++;}
 });
 await Promise.all([
  (async()=>{if(!sends.length)return;let outcomes;try{const payload=sends.map(item=>nativePushMessage(item,text=>translate(item.locale,text)));const tickets=await provider.send(payload);outcomes=new Map(sends.map((item,index)=>[item.id,nativePushOutcome(tickets[index])]));}catch{outcomes=new Map();}await complete(sends,outcomes);})(),
  (async()=>{if(!receipts.length)return;let outcomes;try{const result=await provider.receipts(receipts.map(item=>item.ticketId));outcomes=new Map(receipts.map(item=>[item.id,nativePushOutcome(result[item.ticketId],true)]));}catch{outcomes=new Map();}await complete(receipts,outcomes);})(),
 ]);
 return stats;
}
