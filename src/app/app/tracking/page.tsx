import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {managedBusinessContext} from '@/lib/identity/business-context.js';
import {PageHeader} from '@/components/page-header';
import {BusinessTrackingSessions} from '@/components/tracking-session-manager';
import {Text} from '@/components/localization';
import {ClipboardCheck} from 'lucide-react';
export const dynamic='force-dynamic';
export default async function AccountTrackingPage({searchParams}:{searchParams:Promise<{view?:string}>}){
 const user=await requireUser(undefined,{allowLimited:true});
 if(['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/provider-shipments');
 if(!['CUSTOMER','SHIPPER','RECEIVER'].includes(user.role))redirect('/app/home');
 if(managedBusinessContext(user)&&(await searchParams)?.view!=='personal')redirect('/app/business/tracking');
 const businesses=(user.business_workspaces||[]).filter(workspace=>workspace.permissions.tracking&&workspace.permissions.team).map(({id,name,handle})=>({id,name,handle}));
 return <div className="page"><PageHeader icon={ClipboardCheck} title={<Text message="Your shipments"/>}/><BusinessTrackingSessions businesses={businesses}/></div>;
}
