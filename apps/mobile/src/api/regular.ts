import type {Place} from '../components/place-picker';
export type Service={id:string;vehicleId:string;driverId:string;geometry:'ROUTE'|'RADIUS';route:Place[];center:Place;boundary:Place[]};
