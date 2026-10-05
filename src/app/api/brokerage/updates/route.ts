import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {listBrokerageRequests} from '@/lib/transport-requests';
export async function GET(request:NextRequest){
 const user=await getCurrentUser({allowLimited:true});if(!user||(user.role!=='ADMIN'&&!(user.role==='SUPPORT'&&user.can_manage_brokerage)))return NextResponse.json({error:'Access denied.'},{status:403});
 try{const q=request.nextUrl.searchParams,data=await listBrokerageRequests(user,q.get('queue')||'MINE',q.get('view')||'ALL',q.get('page'));
 const revision=createHash('sha256').update(JSON.stringify([data.items.map(item=>[item.id,item.version,item.last_message_sequence]),data.counts,data.queues])).digest('hex');const etag=`"${revision}"`;
 return request.headers.get('if-none-match')===etag?new NextResponse(null,{status:304,headers:{etag,'Cache-Control':'private, no-store'}}):NextResponse.json({revision:etag},{headers:{etag,'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Request updates are unavailable.'},{status:503});}
}
