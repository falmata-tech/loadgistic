import styles from '@/app/admin/admin-presentation.module.css';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import Link from 'next/link';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {hasPlatformPermission,PLATFORM_PERMISSIONS} from '@/lib/platform-admin.js';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {Text} from '@/components/localization';
import {StatusPill} from '@/components/status-pill';
import {displayStatus} from '@/lib/ui';
import {readWindowedPage} from '@/lib/pagination.js';
const row=z.object({id:z.string().uuid(),handle:z.string(),category:z.string(),detail:z.string(),status:z.string(),created_at:z.string(),decision_note:z.string().nullable()});
export default async function ContentQueue({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});if(!hasPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST))redirect('/support');
 const query=await searchParams;
 const result=await readWindowedPage(async(offset:number,limit:number)=>{
  const {data,error,count,status}=await createSupabaseAdminClient().from('content_reports').select('*',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+limit-1);
  if(offset>0&&status===416&&error?.code==='PGRST103')return [];
  if(error)throw Error('CONTENT_QUEUE_UNAVAILABLE');
  return z.array(row).parse(data).map(payload=>({payload,total_count:count||0}));
 },{page:query.page,pageSize:20});
 const rows:z.infer<typeof row>[]=result.items,page=result.page;
 return <div className={"page "+styles.workspace}><PageHeader title={<Text message="Content reports"/>}/><Flash error={query.error} success={query.success}/><Link href="/admin/reviews" className="button secondary"><Text message="Back to reviews"/></Link>
 {!rows.length?<p><Text message="No content reports yet."/></p>:rows.map(r=><section className={styles.caseRow} key={r.id}><header className={styles.caseHeader}><div><h2>@{r.handle}</h2><p><Text message={displayStatus(r.category)}/> · <time dateTime={r.created_at}>{r.created_at.slice(0,10)}</time></p></div><StatusPill status={r.status}/></header><p style={{whiteSpace:'pre-wrap'}}>{r.detail}</p><div className="button-row"><Link href={`/providers/${r.handle}`} className="button secondary"><Text message="View profile"/></Link><Link href={`/admin/operations?view=WORKSPACES&q=${encodeURIComponent(r.handle)}`} className="button secondary"><Text message="Investigate transporter"/></Link></div>{r.decision_note?<p>{r.decision_note}</p>:null}{['PENDING','HIDDEN'].includes(r.status)?<WorkspaceTaskDialog title="Review content report" triggerLabel="Review report"><form className={styles.decisionForm} action={`/api/admin/content/${r.id}`} method="post"><label><Text message="Decision note"/><textarea name="note" required minLength={5} maxLength={1000}/></label><div className="button-row">{r.status==='PENDING'?<><button name="decision" value="HIDE" className="button danger"><Text message="Hide reported content"/></button><button name="decision" value="DISMISS" className="button secondary"><Text message="Dismiss report"/></button></>:<button name="decision" value="RESTORE" className="button"><Text message="Restore reviewed content"/></button>}</div></form></WorkspaceTaskDialog>:null}</section>)}
 <div className="button-row">{page>1?<Link href={`/admin/reviews/content?page=${page-1}`} className="button secondary"><Text message="Previous"/></Link>:null}{page<result.pageCount?<Link href={`/admin/reviews/content?page=${page+1}`} className="button secondary"><Text message="Next"/></Link>:null}</div></div>;
}
