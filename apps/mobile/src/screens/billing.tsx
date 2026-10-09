import {Redirect} from 'expo-router';
// Retain the old deep link; platform payment plans are retired.
export default function BillingScreen(){return <Redirect href="/account-settings"/>;}
