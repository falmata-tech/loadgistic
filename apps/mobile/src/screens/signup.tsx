import {Redirect,router} from 'expo-router';
import {useAccount} from '../session/provider';
import {AuthEntry} from './account';
import {Button,Card,Copy,LoadingSpinner,Page,Title} from '../components/ui';
import {AppLink} from '../components/app-link';
import {signupBenefits} from '../../../../src/lib/platform-copy.js';
import {useLanguage} from '../localization/provider';

export default function Signup(){
 const account=useAccount();
 const {t}=useLanguage();
 if(account.busy)return <Page><LoadingSpinner/></Page>;
 if(!account.session)return <AuthEntry mode="SIGNUP"/>;
 if(account.session.state==='ONBOARDING')return <Page><Title message="Choose your account"/><Copy message="Your email is verified. Choose how you will use Loadgistic."/><Card><Title message="Transport Provider"/><Copy>{t(signupBenefits.provider[1])}</Copy><Button message="Continue as Transport Provider" onPress={()=>router.replace('/account?setup=provider')}/></Card><Card><Title message="Shipper / broker"/><Copy>{t(signupBenefits.business[1])}</Copy><Button secondary message="Continue as Shipper / broker" onPress={()=>router.replace('/account?setup=business')}/></Card><AppLink href="/about" message="See how Loadgistic works"/></Page>;
 return <Redirect href="/"/>;
}
