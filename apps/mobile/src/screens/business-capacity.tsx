import {Redirect} from 'expo-router';

// Existing workspace links open the shared view of the single Capacity map.
export default function BusinessCapacity(){return <Redirect href="/?view=private"/>;}
