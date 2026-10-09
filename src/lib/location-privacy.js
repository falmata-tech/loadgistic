const EARTH_RADIUS_KM=6371;

export function isValidCoordinate(latitude,longitude) {
  return typeof latitude==='number'&&typeof longitude==='number'
    &&Number.isFinite(latitude)&&Number.isFinite(longitude)
    &&Math.abs(latitude)<=90&&Math.abs(longitude)<=180;
}

export const LOCAL_CAPACITY_PRIVACY_RADII_KM=Object.freeze([1,3,5,10,20,40]);
export const LONG_DISTANCE_CAPACITY_PRIVACY_RADII_KM=LOCAL_CAPACITY_PRIVACY_RADII_KM;
export const BUSINESS_SEARCH_PRIVACY_KM=1;

export function capacityPrivacyRadii(movementScope) {
  return movementScope==='LOCAL'
    ? LOCAL_CAPACITY_PRIVACY_RADII_KM
    : LONG_DISTANCE_CAPACITY_PRIVACY_RADII_KM;
}

export function validateCapacityPrivacyRadius(movementScope,value) {
  const radius=Number(value);
  if(!capacityPrivacyRadii(movementScope).includes(radius))throw new Error('INVALID_LOCATION_PRIVACY');
  return radius;
}

export function possibleDistanceRange(centerDistanceKm,truckPrivacyKm,businessPrivacyKm=BUSINESS_SEARCH_PRIVACY_KM) {
  const centerDistance=Number(centerDistanceKm);
  const uncertainty=Number(truckPrivacyKm)+Number(businessPrivacyKm);
  if(!Number.isFinite(centerDistance)||!Number.isFinite(uncertainty)||uncertainty<0)throw new Error('INVALID_DISTANCE_RANGE');
  return {
    minKm:Math.max(0,Math.round(centerDistance-uncertainty)),
    maxKm:Math.max(0,Math.round(centerDistance+uncertainty))
  };
}

export function obscureCoordinate(latValue,lngValue,distanceKm=35) {
  const lat=Number(latValue);
  const lng=Number(lngValue);
  const distance=Number(distanceKm);
  if(latValue===null||lngValue===null||latValue===''||lngValue===''
    ||!isValidCoordinate(lat,lng)||!Number.isFinite(distance)||distance<=0) {
    throw new Error('INVALID_LOCATION');
  }
  // Share a many-to-one area center, never a known fixed-distance circle around
  // raw GPS. The latter can be triangulated across capacity/tracking radii.
  // Latitude/longitude spacing depends only on the cell, not the raw latitude.
  // A latitude path plus a longitude path to any corner is <0.98*radius; the
  // margin also covers five-decimal rounding. Cells remain stable within a fix.
  const latBands=Math.ceil(Math.PI/(distance*0.49/EARTH_RADIUS_KM));
  const latStep=Math.PI/latBands;
  const row=Math.min(latBands-1,Math.floor((lat*Math.PI/180+Math.PI/2)/latStep));
  const south=-Math.PI/2+row*latStep,north=south+latStep;
  const latitude=(south+north)/2;
  const nearEquator=south<=0&&north>=0?0:Math.min(Math.abs(south),Math.abs(north));
  const longitudeStep=distance*0.49/(EARTH_RADIUS_KM*Math.max(1e-12,Math.cos(nearEquator)));
  const columns=Math.max(1,Math.ceil(2*Math.PI/longitudeStep));
  const lngStep=2*Math.PI/columns;
  const wrapped=((lng+180)%360+360)%360-180;
  const column=Math.min(columns-1,Math.floor((wrapped*Math.PI/180+Math.PI)/lngStep));
  // Use the neighboring cell center: raw fixes inside this cell share one
  // displaced point, including a raw fix at a grid center. The farthest corner
  // remains within the selected radius (0.245R latitude + 0.735R longitude).
  const longitude=-Math.PI+((column+1)%columns+0.5)*lngStep;
  return {lat:Number((latitude*180/Math.PI).toFixed(5)),lng:Number((longitude*180/Math.PI).toFixed(5))};
}
