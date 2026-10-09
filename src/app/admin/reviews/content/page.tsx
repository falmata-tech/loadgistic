import Link from 'next/link';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {hasPlatformPermission,PLATFORM_PERMISSIONS} from '@/lib/platform-admin.js';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {Text} from '@/components/localization';
const row=z.object({id:z.string().uuid(),handle:z.string(),category:z.string(),detail:z.string(),status:z.string(),created_at:z.string(),decision_note:z.string().nullable()});
export default async function ContentQueue({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});if(!hasPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST))redirect('/support');
 const query=await searchParams,page=Math.max(1,Math.min(100000,Number(query.page)||1));
 const {data,error,count}=await createSupabaseAdminClient().from('content_reports').select('*',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*20,page*20-1);
 if(error)throw Error('CONTENT_QUEUE_UNAVAILABLE');const rows=z.array(row).parse(data);
 return <div className="page"><PageHeader title={<Text message="Content reports"/>}/><Flash error={query.error} success={query.success}/><Link href="/admin/reviews" className="button secondary"><Text message="Back to reviews"/></Link>
 {!rows.length?<p><Text message="No content reports yet."/></p>:rows.map(r=><section className="card stack" key={r.id}><h2>@{r.handle}</h2><p>{r.category} · {r.status} · {r.created_at.slice(0,10)}</p><p style={{whiteSpace:'pre-wrap'}}>{r.detail}</p><div className="button-row"><Link href={`/providers/${r.handle}`} className="button secondary"><Text message="View profile"/></Link><Link href={`/admin/operations?view=WORKSPACES&q=${encodeURIComponent(r.handle)}`} className="button secondary"><Text message="Investigate transporter"/></Link></div>{r.decision_note?<p>{r.decision_note}</p>:null}{['PENDING','HIDDEN'].includes(r.status)?<form className="stack" action={`/api/admin/content/${r.id}`} method="post"><label><Text message="Decision note"/><textarea name="note" required minLength={5} maxLength={1000}/></label><div className="button-row">{r.status==='PENDING'?<><button name="decision" value="HIDE" className="button danger"><Text message="Hide reported content"/></button><button name="decision" value="DISMISS" className="button secondary"><Text message="Dismiss report"/></button></>:<button name="decision" value="RESTORE" className="button"><Text message="Restore reviewed content"/></button>}</div></form>:null}</section>)}
 <div className="button-row">{page>1?<Link href={`/admin/reviews/content?page=${page-1}`} className="button secondary"><Text message="Previous"/></Link>:null}{page*20<(count||0)?<Link href={`/admin/reviews/content?page=${page+1}`} className="button secondary"><Text message="Next"/></Link>:null}</div></div>;
}
