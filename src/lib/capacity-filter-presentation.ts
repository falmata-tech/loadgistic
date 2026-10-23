const kmChoices=(values:readonly number[])=>values.map(value=>[String(value),`${value} km`] as const);

/** Shared user-facing filter choices for the web and Expo clients. */
export const CAPACITY_FILTER_PRESENTATION={
  groups:{
    vehicle:{label:'Vehicle',icon:'truck'},
    location:{label:'Location',icon:'pin'},
    route:{label:'Route',icon:'route'},
    more:{label:'More filters',icon:'filters'},
  },
  cityDistance:{defaultKm:50,choices:kmChoices([5,10,25,50,100,200,300])},
  nearbyDistance:{defaultKm:20,choices:kmChoices([5,10,20,50,100])},
  routeDistance:{defaultKm:50,choices:kmChoices([10,25,50,100,200])},
  locationSource:{label:'Location source',anyLabel:'Any location source',options:[['GPS','GPS device'],['MOBILE','Driver’s phone'],['MANUAL','Manually entered']] as const},
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
