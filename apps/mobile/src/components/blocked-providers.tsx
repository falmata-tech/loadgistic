import {useState} from 'react';
import {useBlockedProviders} from '../hooks/content-blocks';
import {Card,Title,Copy,Button,ErrorText} from './ui';
export function BlockedProviders(){const prefs=useBlockedProviders(),[error,setError]=useState('');return <Card><Title message="Blocked transporters"/><Copy message="Blocks apply to this device. Unblocking restores matching profiles and trucks."/><ErrorText message={error}/>{!prefs.blocked.length?<Copy message="No blocked transporters."/>:prefs.blocked.map(handle=><Card key={handle}><Copy>@{handle}</Copy><Button secondary message="Unblock transporter" onPress={()=>{void prefs.set(handle,false).catch(()=>setError('Your preference could not be saved. Try again.'));}}/></Card>)}</Card>}
