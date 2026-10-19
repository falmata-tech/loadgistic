import Link from 'next/link';
import {Satellite,ArrowLeft} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {getAdminOperations} from '@/lib/platform-admin.js';
import {PageHeader} from '@/components/page-header';
import {Text} from '@/components/localization';
import {AdminDeviceProvision} from '@/components/admin-device-provision';
import {Pagination} from '@/components/pagination';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
export default async function AdminDevices({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['ADMIN']),query=await searchParams;
 const data=await getAdminOperations(user,String(query.q||'').slice(0,120),{view:'WORKSPACES',page:query.page,pageSize:20});
 const owners=(data.items as {id:string;name:string;record_kind:string;type:string}[]).filter(row=>['ORGANIZATION','PROVIDER_PROFILE'].includes(row.record_kind)&&!String(row.type).startsWith('ENTERPRISE')).map(row=>({id:row.id,name:row.name,kind:row.record_kind as 'ORGANIZATION'|'PROVIDER_PROFILE'}));
 return <div className="page"><PageHeader icon={Satellite} title={<Text message="Fleet GPS devices"/>} action={<Link href="/admin/operations?view=TRUCKS" className="button secondary small"><ArrowLeft size={16}/><Text message="Vehicles"/></Link>}/><form method="get" className="board-filter-bar"><label><Text message="Find transport provider"/><input name="q" maxLength={120} defaultValue={query.q||''}/></label><button className="button secondary"><Text message="Search"/></button></form>
  <WorkspaceTaskDialog title="Add GPS device" triggerLabel="Add GPS device" triggerClassName="button" disabled={!owners.length}><AdminDeviceProvision owners={owners} gatewayId={process.env.TELEMATICS_DEFAULT_GATEWAY_ID||''}/></WorkspaceTaskDialog>
  <Pagination path="/admin/devices" query={{q:query.q}} page={data.pagination.page} pageCount={data.pagination.pageCount} total={data.pagination.total}/>
 </div>;
}
