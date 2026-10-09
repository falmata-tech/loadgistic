import {BackgroundTracking} from '../components/background-tracking';
import {ContentPolicyConsent} from '../components/content-policy-consent';
import {Tabs} from 'expo-router';
import {LanguageProvider} from '../localization/provider';
import {VisitorProvider} from '../session/visitor-provider';
import {AccountProvider} from '../session/provider';
import {ChatAlertProvider} from '../session/chat-alert-provider';
export default function Layout(){return <LanguageProvider><AccountProvider><BackgroundTracking/><ContentPolicyConsent/><VisitorProvider><ChatAlertProvider>
 <Tabs initialRouteName="(marketplace)" backBehavior="history" tabBar={()=>null} screenOptions={{headerShown:false,popToTopOnBlur:false}}>
  <Tabs.Screen name="(marketplace)"/><Tabs.Screen name="(workspace)"/>
 </Tabs>
</ChatAlertProvider></VisitorProvider></AccountProvider></LanguageProvider>;}
