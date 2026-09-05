export const EXISTING_DRIVER_PORTRAIT_PRESETS=Object.freeze([
  'abebe-owner-operator.jpg',
  'abel-tesfaye-transport.jpg',
  'abyssinia-road-cargo-03.jpg',
  'awash-fleet-services-04.jpg',
  'biruk-amare-transport.jpg',
  'blue-river-logistics-06.jpg',
  'blueline-transport.jpg',
  'dawit-mekonnen-transport.jpg',
  'fikru-desta-transport.jpg',
  'henok-girma-transport.jpg',
  'highland-transit-ethiopia-05.jpg',
  'merkato-cargo-fleet-08.jpg',
  'mulugeta-solomon-transport.jpg',
  'mustefa-ali-transport.jpg',
  'nebiyu-haile-transport.jpg',
  'rift-valley-haulage-02.jpg',
  'samuel-getachew-transport.jpg',
  'sheger-freight-network-01.jpg',
  'walia-freight-lines-07.jpg',
  'yared-demissie-transport.jpg',
  'zelalem-tesema-transport.jpg'
]);

export const NEW_DRIVER_PORTRAIT_PRESETS=Object.freeze([
  'driver-male-cargo-van-v1.jpg',
  'driver-male-cargo-van-v2.jpg',
  'driver-male-cargo-van-v3.jpg',
  'driver-male-cargo-van-v4.jpg',
  'driver-male-heavy-trailer-v1.jpg',
  'driver-male-heavy-trailer-v2.jpg',
  'driver-male-heavy-v1.jpg',
  'driver-male-heavy-v2.jpg',
  'driver-male-light-box-v1.jpg',
  'driver-male-light-stake-v1.jpg',
  'driver-male-medium-box-v1.jpg',
  'driver-male-medium-flatbed-v1.jpg',
  'driver-male-medium-stake-v1.jpg',
  'driver-male-medium-v1.jpg',
  'driver-male-mini-box-v1.jpg',
  'driver-male-mini-box-v2.jpg',
  'driver-male-mini-box-v3.jpg',
  'driver-male-mini-stake-v1.jpg',
  'driver-male-mini-stake-v2.jpg',
  'driver-male-mini-stake-v3.jpg',
  'driver-male-pickup-stake-v1.jpg',
  'driver-male-pickup-v1.jpg',
  'driver-male-pickup-v2.jpg',
  'driver-male-refrigerated-v1.jpg'
]);

export const DRIVER_PORTRAIT_PRESETS=Object.freeze([
  ...EXISTING_DRIVER_PORTRAIT_PRESETS,
  ...NEW_DRIVER_PORTRAIT_PRESETS
]);

const DRIVER_PORTRAIT_SET=new Set(DRIVER_PORTRAIT_PRESETS);

export function driverPortraitUrl(filename){
  const value=String(filename||'');
  return DRIVER_PORTRAIT_SET.has(value)?`/marketing/drivers/${value}`:null;
}
