import type {LocationRequest,LocationBinding,PhoneLocationProof} from './phone-installation-controller';
export function configurePhoneLocation(actor:string,request:LocationRequest|null,stop?:()=>Promise<void>):void;
export function preparePhoneLocation():Promise<{binding:LocationBinding;proof(observedAt:number,observation?:import('./phone-observation').PhoneObservation):PhoneLocationProof}|null>;
export function releasePhoneLocation():Promise<void>;
export function locationInstallationIdentity():Promise<{installationId:string;secret:string}>;
