const kmChoices=(values:readonly number[])=>values.map(value=>[String(value),`${value} km`] as const);

/** Shared user-facing filter choices for the web and Expo clients. */
export const CAPACITY_FILTER_PRESENTATION={
  groups:{
    vehicle:{label:'Vehicle',icon:'truck'},
    availability:{label:'Area or route',icon:'route'},
    location:{label:'Vehicle location',icon:'pin'},
    more:{label:'More filters',icon:'filters'},
  },
  cityDistance:{defaultKm:50,choices:kmChoices([5,10,25,50,100,200,300])},
  nearbyDistance:{defaultKm:20,choices:kmChoices([5,10,20,50,100])},
  routeDistance:{defaultKm:50,choices:kmChoices([10,25,50,100,200])},
  locationSource:{label:'Location source',anyLabel:'Any location source',options:[['GPS','GPS device'],['MOBILE','Driver’s phone'],['MANUAL','Manually entered']] as const},
  availableSpace:{label:'Available space',options:[['','Any amount'],['25','25% or more'],['50','50% or more'],['75','75% or more']] as const},
  privatePhoto:{label:'Cargo space photo',options:[['','Any photo status'],['present','With photo'],['12','Within 12 hours'],['24','Within 24 hours'],['72','Within 3 days'],['168','Within 7 days']] as const},
  stops:{label:'Stops',anyLabel:'Any stop pattern',options:[['MULTI_PICK','Multiple pickups'],['MULTI_DROP','Multiple drop-offs']] as const},
  freshness:{label:'Updated',anyLabel:'Any published capacity',options:[['FRESH','Within 12 hours'],['UPDATE_NEEDED','More than 12 hours ago']] as const},
  routeDirection:{label:'Direction',options:[['DIRECT','Origin to destination'],['EITHER','Either direction']] as const},
  documents:{
    title:'Reviewed documents',
    groups:[
      {key:'ownerDocs',label:'Company or owner',options:[['IDENTITY','National ID'],['BUSINESS_LICENSE','Business License'],['BUSINESS_ADDRESS','Business Address']] as const},
      {key:'driverDocs',label:'Driver documents',options:[['IDENTITY','National ID'],['DRIVER_IDENTITY','Driving licence']] as const},
      {key:'truckDocs',label:'Vehicle documents',options:[['VEHICLE_OWNERSHIP','Vehicle ownership'],['VEHICLE_AUTHORIZATION','Permission to use vehicle'],['VEHICLE_OPERATING_LICENSE','Vehicle operating licence']] as const},
    ],
  },
} as const;

export type CapacityQueryShape='AREA'|'ROUTE';
type RouteQuery={origin?:string;originLabel?:string;originPlaceRef?:string;destination?:string;destinationLabel?:string;destinationPlaceRef?:string};
/** This selects a search shape, never the vehicle offer's geometry or source. */
export function initialCapacityQueryShape(query:RouteQuery):CapacityQueryShape{
  return [query.originPlaceRef,query.origin,query.originLabel,query.destinationPlaceRef,query.destination,query.destinationLabel].some(value=>Boolean(value?.trim()))?'ROUTE':'AREA';
}
/** Keep inactive drafts locally, while sending only the applied query shape. */
export function capacityQueryForShape<T extends object>(draft:T,shape:CapacityQueryShape):Partial<T>{
  const next={...draft};
  const inactive=shape==='AREA'
    ?['origin','originLabel','originPlaceRef','originRadiusKm','destination','destinationLabel','destinationPlaceRef','destinationRadiusKm','directionMode']
    :['currentArea','currentAreaLabel','currentAreaPlaceRef','currentAreaRadiusKm'];
  for(const field of inactive)Reflect.deleteProperty(next,field);
  return next;
}
