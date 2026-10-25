import {useState} from 'react';
import {Redirect} from 'expo-router';
import {useAccount} from '../session/provider';
import {AccountDirectoryNative} from '../components/account-directory';
import {ActionLink} from '../components/action-link';
import {WorkspaceTabs,WorkspaceTaskPane} from '../components/workspace-task';
import {Page,Title,LoadingSpinner} from '../components/ui';
export default function Directory(){
 const account=useAccount(),[view,setView]=useState('FIND');
 if(account.busy)return <Page><LoadingSpinner/></Page>;
 if(!account.session)return <Redirect href="/account"/>;
 if(account.session.user.role!=='CUSTOMER')return <Redirect href="/network"/>;
 return <Page><Title message="Network"/><ActionLink href="/?view=private" message="Shared with you" icon="map"/>
  <WorkspaceTabs value={view} items={[{id:'FIND',message:'Find accounts'},{id:'CONNECTIONS',message:'Connections'}]} onChange={setView}/>
  <WorkspaceTaskPane active={view==='FIND'}><AccountDirectoryNative view="FIND"/></WorkspaceTaskPane>
  <WorkspaceTaskPane active={view==='CONNECTIONS'}><AccountDirectoryNative view="CONNECTIONS"/></WorkspaceTaskPane>
 </Page>;
}
