import {useMemo} from 'react';
import {ActivityIndicator} from 'react-native';
import {Redirect} from 'expo-router';
import {useAccount} from '../session/provider';
import {Page,Copy} from '../components/ui';
import {BusinessCapacityMap} from './capacity';
export default function BusinessCapacity(){
 const account=useAccount(),session=account.session,workspace=session?.user.selectedBusinessWorkspace;
 const workspaceId=workspace?.id,scopeKey=`${session?.user.id||''}:${workspaceId||''}:${workspace?.membershipRevision||0}`;
 const context=useMemo(()=>workspaceId?{workspaceId,scopeKey,request:account.request}:null,[workspaceId,scopeKey,account.request]);
 if(account.busy)return <Page><ActivityIndicator/></Page>;
 if(!session)return <Redirect href="/account"/>;
 if(session.user.role!=='CUSTOMER'||!workspace||!context)return <Redirect href="/workspaces"/>;
 if(!workspace.permissions.capacity)return <Page><Copy message="Your team access does not include that page. Contact your business admin."/></Page>;
 return <BusinessCapacityMap context={context}/>;
}
