import {PublicHeader} from '@/components/public-header';
import {TrackingUnlockForm} from '@/components/tracking-unlock-form';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
export default function TrackingPage(){return <><PublicHeader/><main className="public-app-page tracking-public-workspace"><TrackingUnlockForm/></main></>;}
