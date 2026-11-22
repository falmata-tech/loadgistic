import {useLocalSearchParams} from 'expo-router';
import {TrackingLinkAccess} from './visitor-tracking';
export default function VisitorShipment(){const {id}=useLocalSearchParams<{id?:string}>();return <TrackingLinkAccess sessionId={typeof id==='string'?id:undefined}/>;}
