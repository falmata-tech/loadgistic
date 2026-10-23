import {Stack} from 'expo-router';
import {NavigationShell} from '../../components/navigation-shell';
import {useAccount} from '../../session/provider';
export const unstable_settings={initialRouteName:'account'};
export default function AreaLayout(){const account=useAccount(),user=account.session?.user,workspace=user?.selectedBusinessWorkspace;return <NavigationShell><Stack key={`${user?.id||'signed-out'}:${workspace?.id||'provider'}:${workspace?.membershipRevision||0}`} screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#fff'}}}/></NavigationShell>;}
