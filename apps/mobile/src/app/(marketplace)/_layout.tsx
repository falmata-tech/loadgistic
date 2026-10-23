import {Stack} from 'expo-router';
import {NavigationShell} from '../../components/navigation-shell';
export const unstable_settings={initialRouteName:'index'};
export default function AreaLayout(){return <NavigationShell><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#fff'}}}/></NavigationShell>;}
