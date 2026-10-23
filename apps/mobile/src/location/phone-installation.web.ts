import type {LocationRequest} from './phone-installation-controller';
// Expo's browser preview reports as an authenticated browser, never a native
// installation. It cannot run the installed background-location service.
export function configurePhoneLocation(_actor:string,_request:LocationRequest|null,_stop?:()=>Promise<void>){}
export async function preparePhoneLocation(){return null;}
export async function releasePhoneLocation(){}
export async function locationInstallationIdentity():Promise<{installationId:string;secret:string}>{throw Error('Phone installation requires the installed app.');}
