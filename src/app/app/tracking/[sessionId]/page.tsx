import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {trackingSessionId} from '@/lib/tracking-sessions/contracts';
import {trackingSessionService} from '@/lib/tracking-sessions/supabase';
import {TrackingSessionManager} from '@/components/tracking-session-manager';
import {PageHeader} from '@/components/page-header';
import {Text} from '@/components/localization';
import {notFound} from 'next/navigation';
import {ClipboardCheck} from 'lucide-react';
export const dynamic='force-dynamic';
export default async function SessionPage({params}:{params:Promise<{sessionId:string}>}){
 const user=await requireUser(undefined,{allowLimited:true}),{sessionId}=await params;
 if(!trackingSessionId.safeParse(sessionId).success)notFound();
 const session=await trackingSessionService().detail(user.id,sessionId);
 const businesses=(user.business_workspaces||[]).filter(workspace=>workspace.permissions.tracking&&workspace.permissions.team).map(({id,name,handle})=>({id,name,handle}));
 return <div className="page tracking-detail-page"><PageHeader icon={ClipboardCheck} title={session.reference} action={<Link className="button secondary" href="/app/tracking"><Text message="Tracking"/></Link>}/><TrackingSessionManager sessionId={sessionId} workspaceId={session.workspaceId||undefined} businesses={businesses}/></div>;
}
