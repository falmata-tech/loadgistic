import {Stack} from 'expo-router';
import {NavigationShell} from '../../components/navigation-shell';
import {useAccount} from '../../session/provider';
export const unstable_settings={initialRouteName:'account'};
export default function AreaLayout(){const account=useAccount();return <NavigationShell><Stack key={account.session?.user.id||'signed-out'} screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#fff'}}}/></NavigationShell>;}
