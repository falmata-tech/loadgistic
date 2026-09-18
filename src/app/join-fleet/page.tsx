import Link from 'next/link';
import {redirect} from 'next/navigation';
import {UserRound,LogOut} from 'lucide-react';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {identityFleetInvitations} from '@/lib/fleet-driver-management';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';

export default async function JoinFleetPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const client=await createSupabaseServerClient();
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)redirect('/login');
  const invitations=await identityFleetInvitations(data.user.id);
  const query=await searchParams;
  return <><PublicHeader/><main className="container fleet-join-page">
    <header><UserRound aria-hidden="true"/><h1 className="page-title">Join your fleet</h1><p>Signed in as {data.user.email}</p></header>
    <Flash error={query.error}/>
    {invitations.map(invitation=><section className="card" key={invitation.id}>
      <h2>{invitation.organization_name}</h2><p>Join as {invitation.driver_name}, Company driver.</p>
      {invitation.can_accept?<><p className="meta">Your fleet owner will assign your truck and choose your access to capacity and Tracking updates. Documents can be added later.</p>
        <form action="/api/fleet/invitations/accept" method="post"><input type="hidden" name="invitationId" value={invitation.id}/><button className="button success">Join fleet</button></form></>
        :<p>This account already has a workspace. Contact support before changing fleets; your current account will not be moved.</p>}
    </section>)}
    {!invitations.length?<section className="card"><h2>No pending invitation</h2><p>Ask the fleet owner to invite this email. Expired and cancelled invitations cannot be accepted.</p><Link className="button secondary" href="/login">Continue to your account</Link></section>:null}
    <form action="/api/auth/logout" method="post"><button className="button secondary"><LogOut aria-hidden="true"/>Use another email</button></form>
  </main></>;
}
