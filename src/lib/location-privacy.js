const EARTH_RADIUS_KM=6371;

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
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(distance)||distance<=0) {
    throw new Error('INVALID_LOCATION');
  }
  const seed=Math.sin(lat*12.9898+lng*78.233)*43758.5453;
  const bearing=(Math.abs(seed)%1)*Math.PI*2;
  const angularDistance=distance/EARTH_RADIUS_KM;
  const latRadians=lat*Math.PI/180;
  const lngRadians=lng*Math.PI/180;
  const obscuredLat=Math.asin(
    Math.sin(latRadians)*Math.cos(angularDistance)
    + Math.cos(latRadians)*Math.sin(angularDistance)*Math.cos(bearing)
  );
  const obscuredLng=lngRadians+Math.atan2(
    Math.sin(bearing)*Math.sin(angularDistance)*Math.cos(latRadians),
    Math.cos(angularDistance)-Math.sin(latRadians)*Math.sin(obscuredLat)
  );
  return {
    lat:Number((obscuredLat*180/Math.PI).toFixed(5)),
    lng:Number((obscuredLng*180/Math.PI).toFixed(5))
  };
}
