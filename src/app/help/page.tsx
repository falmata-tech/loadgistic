import Link from 'next/link';
import {PublicHeader} from '@/components/public-header';
import {Text} from '@/components/localization';
import {getCurrentUser} from '@/lib/auth';

export default async function HelpPage(){
 const user=await getCurrentUser({allowLimited:true});
 const href=user?.role==='ADMIN'?'/admin/support':user?.role==='SUPPORT'?'/support':'/app/support';
 return <><PublicHeader/><main className="public-app-page public-information-workspace"><header className="public-information-heading container">
  <h1><Text message="Support"/></h1>
  <p><Text message="Contact the Loadgistic team from your account."/></p>
  <Link className="button" href={user?href:'/login?from=support'}><Text message={user?'Open dashboard support':'Sign in'}/></Link>
 </header></main></>;
}
