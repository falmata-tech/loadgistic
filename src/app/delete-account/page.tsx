import type {Metadata} from 'next';
import {PublicHeader} from '@/components/public-header';
import {Text} from '@/components/localization';
import {AccountDeletionForm} from '@/components/account-deletion-form';
export const metadata:Metadata={title:'Delete your Loadgistic account',description:'Verify your account email and request permanent account and personal-data deletion without reinstalling the app.'};
export default function DeleteAccount(){return <><PublicHeader/><main className="public-app-page public-information-workspace container" style={{maxWidth:680,paddingTop:32}}><h1><Text message="Delete account and data"/></h1><p><Text message="You can make this request without signing into the app. Verify the email used for your account."/></p><AccountDeletionForm showHeading={false}/></main></>}
