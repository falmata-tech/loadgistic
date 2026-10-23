export type PhoneObservation={accuracyMeters:number|null;speedKph:number|null;headingDegrees:number|null};
/** Expo reports speed in m/s and -1 when unavailable; unknown is never zero. */
export function phoneObservation(coords:{accuracy:number|null;speed?:number|null;heading?:number|null}):PhoneObservation{
 const bounded=(value:number|null|undefined,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max?value:null;
 return {accuracyMeters:bounded(coords.accuracy,40000),speedKph:typeof coords.speed==='number'?bounded(coords.speed*3.6,300):null,headingDegrees:typeof coords.heading==='number'&&coords.heading<360?bounded(coords.heading,360):null};
}
