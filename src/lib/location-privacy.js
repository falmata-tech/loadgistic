const EARTH_RADIUS_KM=6371;

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
