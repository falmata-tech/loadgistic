import Link from 'next/link';
import {Text} from './localization';
import {VerificationBadges,type VerificationBadge} from './verification-badges';
import {VerificationForm} from './verification-form';
import {StatusPill} from './status-pill';
export type DocumentCenter={subjects:Array<{subject_type:string;subject_id:string;name:string;type:string;allowed_types:string[];pending_count?:number;vehicles?:Array<{id:string;label:string}>;badges?:VerificationBadge[]}>;requests:Array<{id:string;subject_type:string;subject_id:string;document_name:string;status:string;submitted_at:string;review_note?:string}>};

export function SubjectDocuments({center,kind,id,returnTo}:{center:DocumentCenter;kind:string;id:string;returnTo:string}){
 const subject=center.subjects.find(item=>item.subject_type===kind&&item.subject_id===id);
 if(!subject)return null;
 const history=center.requests.filter(item=>item.subject_type===kind&&item.subject_id===id);
 return <div className="stack" data-subject-kind={subject.subject_type}><VerificationBadges badges={subject.badges}/>
  <VerificationForm subjects={[subject]} initialTruckId={kind==='VEHICLE'?id:undefined} returnTo={returnTo}/>
  <details className="workspace-related-section"><summary><Text message="Request history"/></summary><div className="stack">
   {history.slice(0,10).map(item=><div className="request-history-row" key={item.id}><strong>{item.document_name}</strong><StatusPill status={item.status}/><p className="meta">{new Date(item.submitted_at).toLocaleString()}</p>{item.review_note?<p>{item.review_note}</p>:null}<a href={`/api/files/verification/${item.id}`} target="_blank" rel="noreferrer"><Text message="Open document"/></a></div>)}
   {!history.length?<p className="meta"><Text message="No verification requests submitted yet."/></p>:null}
   {history.length>10?<Link href="/app/verification"><Text message="Request history"/></Link>:null}
  </div></details>
 </div>;
}
