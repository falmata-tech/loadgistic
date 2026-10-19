import type {AccountDocument,AccountSection} from '@/lib/platform-admin/account';
import {Text} from './localization';
import {StatusPill} from './status-pill';
import {WorkspaceTaskDialog} from './workspace-task-dialog';
import {Pagination} from './pagination';
import styles from './admin-account-overview.module.css';

export function AdminRecordDocuments({data,title,path,query,returnTo}:{data:AccountSection<AccountDocument>;title:string;path:string;query:Record<string,string|undefined>;returnTo:string}){
 if(!data.permitted)return null;
 return <section id="documents" className={styles.entityDocuments}>
  <header><h2><Text message={title}/></h2></header>
  {data.items.length?<><ul className={styles.records}>{data.items.map(document=><li key={document.id}>
   <div><strong>{document.document_name}</strong><small>{new Date(document.submitted_at).toLocaleDateString()}</small>{document.review_note?<small>{document.review_note}</small>:null}</div>
   <div className={styles.recordEnd}><StatusPill status={document.status}/><a className="button secondary small" href={`/api/files/verification/${document.id}`} target="_blank" rel="noreferrer"><Text message="View document"/></a>
    {!['APPROVED','REJECTED'].includes(document.status)?<WorkspaceTaskDialog title="Review document" triggerLabel="Review document"><form action={`/api/admin/verifications/${document.id}`} method="post" className="stack"><input type="hidden" name="returnTo" value={returnTo}/><label><Text message="Review note"/><input name="note" maxLength={1000}/></label><div className="button-row"><button className="button success" name="status" value="APPROVED"><Text message="Approve"/></button><button className="button secondary" name="status" value="MORE_INFO"><Text message="More info"/></button><button className="button danger" name="status" value="REJECTED"><Text message="Reject"/></button></div></form></WorkspaceTaskDialog>:null}
   </div>
  </li>)}</ul><Pagination path={path} query={query} page={data.page} pageCount={data.pageCount} total={data.total} pageParam="documentPage" fragment="documents"/></>:<p className={styles.empty}><Text message="No submitted documents"/></p>}
 </section>;
}
