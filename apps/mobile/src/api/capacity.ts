import {locationSourceKind} from '../../../../src/lib/location-source.js';
import type {Place} from '../components/place-picker';
import type {Service} from './regular';
export type CapacitySignal = { id:string; status: string; visibility: string; sharingMode: string; exclusiveEmail: string; exclusiveName: string; updatedAt: string; acceptedLoads: string | null; availablePercent: number | null; availablePercentReportedAt: string; availabilityGeometry: string; route: Place[]; boundary: Place[]; areaCenter: Place; acceptsMultiPick: boolean; acceptsMultiDrop: boolean };
export type CapacityTruck = { id: string; label: string; plate: string; driver: string; driverId:string;configuration:string;publishedLocationSource:'GPS'|'MOBILE'|null;locationIsDemo:boolean;regularServices:Service[];canLocate: boolean;canSetPhoneLocation?:boolean; dutyConfigured: boolean; selectedLocationSource?:'GPS'|'MOBILE'|null; location: { area: string; radius: number; updatedAt: string; coordinate: number[] | null } | null; current: CapacitySignal | null };
export type CapacityWorkspace = { profilePublished: boolean | null; canPublish: boolean; vehicles: CapacityTruck[] };

export function currentCapacityLocation(truck:CapacityTruck):CapacityTruck['location']{
 if(truck.selectedLocationSource!==undefined&&truck.selectedLocationSource!=='GPS'&&truck.selectedLocationSource!=='MOBILE')return null;
 return locationSourceKind(truck.publishedLocationSource)?truck.location:null;
}
