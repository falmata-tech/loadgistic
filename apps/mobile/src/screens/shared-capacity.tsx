import {Redirect} from 'expo-router';

// Existing deep links open the shared view of the single Capacity map.
export default function SharedCapacity(){return <Redirect href="/?view=private"/>;}
