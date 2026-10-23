import styles from '@/app/admin/admin-presentation.module.css';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import Link from 'next/link';
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {Text} from '@/components/localization';
import {StatusPill} from '@/components/status-pill';
import {readWindowedPage} from '@/lib/pagination.js';
const row=z.object({id:z.string().uuid(),subject_user_id:z.string().uuid(),status:z.string(),requested_at:z.string(),review_due_at:z.string(),retention_reason:z.string().nullable(),review_after:z.string().nullable(),completed_at:z.string().nullable()});
export default async function PrivacyQueue({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 await requireUser(['ADMIN'],{allowLimited:true});const query=await searchParams;
 const result=await readWindowedPage(async(offset:number,limit:number)=>{
  const {data,error,count,status}=await createSupabaseAdminClient().from('account_deletion_requests').select('*',{count:'exact'}).order('requested_at').range(offset,offset+limit-1);
  if(offset>0&&status===416&&error?.code==='PGRST103')return [];
  if(error)throw Error('PRIVACY_QUEUE_UNAVAILABLE');
  return z.array(row).parse(data).map(payload=>({payload,total_count:count||0}));
 },{page:query.page,pageSize:20});
 const rows:z.infer<typeof row>[]=result.items,page=result.page;
 const identities=rows.length?await createSupabaseAdminClient().from('profiles').select('id,full_name,email').in('id',rows.map(r=>r.subject_user_id)):{data:[],error:null};if(identities.error)throw Error('PRIVACY_QUEUE_UNAVAILABLE');
 const people=z.array(z.object({id:z.string().uuid(),full_name:z.string(),email:z.string()})).parse(identities.data);
 const names=new Map(people.map(p=>[p.id,p] as const));
 return <div className={"page "+styles.workspace}><PageHeader title={<Text message="Account deletion requests"/>}/><Flash error={query.error} success={query.success}/><Link href="/admin/operations?view=USERS" className="button secondary"><Text message="Back to users"/></Link>
 <p className={styles.safetyNote}><Text message="Verify the request and its account before erasing. Cleanup is permanent. Active shipments and company transfers are held with an explanation; failed file or identity cleanup stays in progress for a safe retry."/></p>
 {!rows.length?<p><Text message="No deletion requests yet."/></p>:rows.map(r=><section key={r.id} data-request-id={r.id} className={styles.caseRow}><header className={styles.caseHeader}><div><h2>{names.get(r.subject_user_id)?.full_name||<Text message="Account record"/>}</h2><p>{names.get(r.subject_user_id)?.email}</p></div><StatusPill status={r.status}/></header><p className="meta"><time dateTime={r.requested_at}>{r.requested_at.slice(0,10)}</time></p><details className={styles.reference}><summary><Text message="Record reference"/></summary><code>{r.subject_user_id}</code></details><p><Text message="Review by"/> {r.review_due_at.slice(0,10)}</p>{r.retention_reason?<p>{r.retention_reason}</p>:null}<Link className="button secondary" href={`/admin/operations/users/${r.subject_user_id}`}><Text message="Review account"/></Link>{r.status!=='COMPLETED'?<WorkspaceTaskDialog title={r.status==='ERASING'?'Continue deletion cleanup':'Process deletion request'} triggerLabel={r.status==='ERASING'?'Continue deletion cleanup':'Process deletion request'} variant="danger"><form action={`/api/admin/privacy/${r.id}`} method="post" className={styles.decisionForm}><label><input type="checkbox" name="reviewed" value="yes" required/><Text message="I reviewed this deletion request and the exact account."/></label><label><Text message="Type DELETE to confirm"/><input name="confirmation" pattern="DELETE" required autoComplete="off"/></label><button className="button danger"><Text message={r.status==='ERASING'?'Continue deletion cleanup':'Process deletion request'}/></button></form></WorkspaceTaskDialog>:<p><Text message="Deletion completed"/></p>}</section>)}
 <div className="button-row">{page>1?<Link href={`/admin/privacy?page=${page-1}`} className="button secondary"><Text message="Previous"/></Link>:null}{page<result.pageCount?<Link href={`/admin/privacy?page=${page+1}`} className="button secondary"><Text message="Next"/></Link>:null}</div></div>;
}
