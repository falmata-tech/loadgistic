import Link from 'next/link';
import {AppInstall} from '@/components/app-install';
import {PublicHeader} from '@/components/public-header';
import {Text} from '@/components/localization';

export const metadata={title:'Install Loadgistic',description:'Add Loadgistic to your home screen.',robots:{index:false,follow:true}};

export default function InstallPage(){
 return <><PublicHeader/><main className="public-app-page public-information-workspace">
  <AppInstall/>
  <div className="container app-install-page"><Link className="button secondary" href="/"><Text message="Home"/></Link></div>
 </main></>;
}
